/**
 * Workers against a real Postgres (PGlite over a local socket): a day is marked once per worker (marking again
 * changes it, clearing removes it), only the farm's own workers and places count, every payment is labour spending,
 * and taking a payment back (here or by deleting its expense) puts what's owed right.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54375
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let w: typeof import("./workers")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
const day = "2026-11-10"

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  w = await import("./workers")
  await prisma.tenant.createMany({ data: ["f1", "f2"].map((id) => ({ id, slug: id, nameTa: id, nameEn: id, phone: "+919000090001", invoicePrefix: "TF" })) })
  await prisma.farmPlace.create({ data: { id: "00000000-0000-4000-8000-000000000001", tenantId: "f1", kind: "shed", name: "Shed" } })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("workers", () => {
  it("marks days, pays wages and advances, and keeps what's owed right", async () => {
    const db = tenantDb("f1")
    const shed = "00000000-0000-4000-8000-000000000001"
    const ravi = await w.saveWorker(db, "f1", null, { name: " Ravi ", phone: null, role: null, payType: "daily", ratePaise: 50_000, joinedOn: null, notes: null })
    const other = await w.saveWorker(tenantDb("f2"), "f2", null, { name: "Other", phone: null, role: null, payType: "daily", ratePaise: 50_000, joinedOn: null, notes: null })
    await w.markDays(db, "f1", day, [{ workerId: ravi, state: "present", placeId: shed }, { workerId: other, state: "present", placeId: null }], "s1")
    await w.markDays(db, "f1", "2026-11-11", [{ workerId: ravi, state: "half", placeId: null }], "s1")
    // Marking again changes the day; another farm's worker is ignored
    await w.markDays(db, "f1", day, [{ workerId: ravi, state: "present", placeId: shed }], "s1")
    expect(await prisma.workerDay.count()).toBe(2)
    let list = await w.workersOn(db, "2026-11-12")
    expect(list).toHaveLength(1)
    // Today starts from where they last worked (the 11th: the whole farm)
    expect(list[0]).toMatchObject({ name: "Ravi", earnedPaise: 75_000, owedPaise: 75_000, state: null, placeId: null })

    await w.payWorker(db, "f1", { workerId: ravi, date: day, kind: "advance", amountPaise: 20_000, note: "Festival", byStaffId: "s1" })
    await w.payWorker(db, "f1", { workerId: ravi, date: "2026-11-11", kind: "wage", amountPaise: 30_000, note: null, byStaffId: "s1" })
    expect(await prisma.expense.findMany({ where: { kind: "labour" }, select: { amountPaise: true, note: true } })).toEqual(expect.arrayContaining([{ amountPaise: 20_000, note: "Ravi · Festival" }]))
    list = await w.workersOn(db, day)
    expect(list[0]).toMatchObject({ paidPaise: 50_000, owedPaise: 25_000, state: "present" })

    const advance = await prisma.workerPayment.findFirstOrThrow({ where: { kind: "advance" } })
    await w.removePayment(db, advance.id)
    expect(await prisma.expense.count({ where: { id: advance.expenseId! } })).toBe(0)
    await expect(w.removePayment(tenantDb("f2"), (await prisma.workerPayment.findFirstOrThrow()).id)).rejects.toThrow("not_found")

    // Clearing a day removes it
    await w.markDays(db, "f1", "2026-11-11", [{ workerId: ravi, state: null, placeId: null }], "s1")
    const month = await w.workerMonth(db, ravi, "2026-11")
    expect(month).toMatchObject({ month: { days: 1, paise: 50_000 }, owedPaise: 20_000 })
    await expect(w.payWorker(db, "f1", { workerId: other, date: day, kind: "wage", amountPaise: 100, note: null, byStaffId: "s1" })).rejects.toThrow("not_found")
  })
})
