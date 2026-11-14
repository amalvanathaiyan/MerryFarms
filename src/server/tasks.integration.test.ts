/**
 * Farm jobs against a real Postgres (PGlite over a local socket): a one-off job is done once, a repeating one moves
 * on; only the one it's for (or the owner and managers) can mark it done; farms stay apart; and the morning
 * notification tells the right phones about jobs, machine service and the store running low.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import type { Note } from "@/domain/notifications"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54379
const TODAY = "2026-11-15"
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let tasks: typeof import("./tasks")
let reminders: typeof import("./reminders")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
const sent: { endpoint: string; note: Note }[] = []

const owner = { id: "owner", roles: ["owner"] }
const packer = { id: "packer", roles: ["packing"] }
const form = (over: Partial<import("./tasks").TaskForm> = {}): import("./tasks").TaskForm => ({ title: "Clean tank", note: null, dueOn: TODAY, repeatEvery: null, repeatUnit: null, placeId: null, assetId: null, forStaffId: null, ...over })

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T02:00:00Z`))
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  tasks = await import("./tasks")
  reminders = await import("./reminders")
  const notify = await import("./notify")
  notify.setPushSenderForTests(async (s, payload) => {
    sent.push({ endpoint: s.endpoint, note: JSON.parse(payload) })
  })
  await prisma.tenant.createMany({
    data: ["f1", "f2"].map((id) => ({ id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan: "pro" as const, phone: "+919000090001", invoicePrefix: "TF" })),
  })
  for (const [id, roles] of [
    ["owner", ["owner"]],
    ["packer", ["packing"]],
  ] as const) {
    await prisma.staffMember.create({ data: { id, tenantId: "f1", authUserId: `auth-${id}`, name: id, roles: [...roles] } })
    await prisma.pushSubscription.create({ data: { tenantId: "f1", staffId: id, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" } })
  }
  await prisma.farmAsset.create({ data: { tenantId: "f1", kind: "motor", name: "Motor", serviceEveryDays: 90, lastServiceOn: "2026-08-10" } })
  await prisma.farmInput.create({ data: { id: "00000000-0000-4000-8000-0000000000aa", tenantId: "f1", name: "Urea", kind: "fertiliser", unit: "bag", lowAt: 3 } })
}, 60_000)

afterAll(async () => {
  vi.useRealTimers()
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("farm jobs", () => {
  it("does a one-off once and moves a repeating job on", async () => {
    const db = tenantDb("f1")
    const once = await tasks.saveTask(db, "f1", null, form({ title: " Clean tank " }), "owner")
    const weekly = await tasks.saveTask(db, "f1", null, form({ title: "Spray", dueOn: "2026-11-10", repeatEvery: 1, repeatUnit: "week" }), "owner")
    await tasks.markTaskDone(db, once, owner)
    expect(await prisma.farmTask.findUniqueOrThrow({ where: { id: once } })).toMatchObject({ title: "Clean tank", doneOn: TODAY, lastDoneBy: "owner" })
    await expect(tasks.markTaskDone(db, once, owner)).rejects.toThrow("not_found")
    await tasks.undoTask(db, once)
    expect((await prisma.farmTask.findUniqueOrThrow({ where: { id: once } })).doneOn).toBeNull()
    // Done late: next week from today
    await tasks.markTaskDone(db, weekly, owner)
    expect(await prisma.farmTask.findUniqueOrThrow({ where: { id: weekly } })).toMatchObject({ dueOn: "2026-11-22", doneOn: null, lastDoneOn: TODAY })
  })

  it("lets only the one it's for, the owner or a manager mark it done; farms stay apart", async () => {
    const db = tenantDb("f1")
    const mine = await tasks.saveTask(db, "f1", null, form({ title: "Pack trays", forStaffId: "packer" }), "owner")
    const bosses = await tasks.saveTask(db, "f1", null, form({ title: "Pay bill" }), "owner")
    await expect(tasks.markTaskDone(db, bosses, packer)).rejects.toThrow("not_found")
    await tasks.markTaskDone(db, mine, packer)
    await expect(tasks.saveTask(db, "f1", null, form({ forStaffId: "00000000-0000-4000-8000-000000000999" }), "owner")).rejects.toThrow("not_found")
    await expect(tasks.markTaskDone(tenantDb("f2"), bosses, owner)).rejects.toThrow("not_found")
    await expect(tasks.removeTask(tenantDb("f2"), bosses)).rejects.toThrow("not_found")
  })

  it("reminds of the motor's service and the urea running low", async () => {
    const r = await tasks.remindersFor(tenantDb("f1"), TODAY, false)
    expect(r.map((x) => [x.kind, x.name])).toEqual([
      ["service", "Motor"],
      ["store", "Urea"],
    ])
  })

  it("tells the owner of their jobs and reminders, and the packer of theirs, in the morning", async () => {
    const db = tenantDb("f1")
    await tasks.saveTask(db, "f1", null, form({ title: "Count trays", forStaffId: "packer", dueOn: "2026-11-14" }), "owner")
    sent.length = 0
    const out = await reminders.farmJobReminders()
    expect(out.find((x) => x.slug === "f1")).toMatchObject({ reminders: 2 })
    const to = (who: string) => sent.find((s) => s.endpoint.endsWith(`/${who}`))?.note
    expect(to("owner")?.body).toContain("Clean tank")
    expect(to("owner")?.body).toContain("Pay bill")
    expect(to("owner")?.body).toContain("Motor")
    expect(to("owner")?.body).not.toContain("Count trays")
    expect(to("packer")?.body).toBe("Count trays (தாமதம் / late)")
  })
})
