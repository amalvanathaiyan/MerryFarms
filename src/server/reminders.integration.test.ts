/**
 * The daily poultry reminders against a real Postgres (PGlite over a local socket): who gets them, what they say,
 * and that farms without poultry care get nothing.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Note } from "@/domain/notifications"

vi.mock("server-only", () => ({}))

const PORT = 54335
const TODAY = "2026-10-20"
const MORNING = new Date("2026-10-20T02:00:00Z") // 7:30 IST
const EVENING = new Date("2026-10-20T12:30:00Z") // 6:00 pm IST

let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let batches: typeof import("./batches")
let reminders: typeof import("./reminders")
let batchId: string
const sent: { endpoint: string; note: Note }[] = []

const tenantRow = (id: string, features: object) => ({
  id,
  slug: id,
  nameTa: id,
  nameEn: id,
  status: "active" as const,
  plan: "pro" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000030001",
  invoicePrefix: "MF",
  whatsappMode: "lite" as const,
  deliveryFeePaise: 0,
  freeAbovePaise: 0,
  features,
})

const day = (date: string, over: Partial<import("./batches").BatchDayInput> = {}): import("./batches").BatchDayInput => ({
  date,
  feedKg: 10,
  eggsCollected: null,
  eggsBroken: null,
  sold: 0,
  soldPaise: 0,
  given: 0,
  note: null,
  losses: [],
  ...over,
})

const phones = () => sent.map((s) => s.endpoint.split("/").pop()).sort()

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  batches = await import("./batches")
  reminders = await import("./reminders")
  const notify = await import("./notify")
  notify.setPushSenderForTests(async (s, payload) => {
    sent.push({ endpoint: s.endpoint, note: JSON.parse(payload) })
  })

  await prisma.tenant.createMany({ data: [tenantRow("t1", { poultryCare: true }), tenantRow("t2", {})] })
  // Farm 1: each role has a phone. Farm 2 (no poultry care) has an owner phone too.
  const staff = [
    ["t1", "owner", ["owner"]],
    ["t1", "packing", ["packing"]],
    ["t1", "desk", ["order_desk"]],
    ["t1", "driver", ["delivery"]],
    ["t2", "owner2", ["owner"]],
  ] as const
  for (const [tenantId, id, roles] of staff) {
    const db = tenantDb(tenantId)
    await db.staffMember.create({ data: { id, tenantId, authUserId: `auth-${id}`, name: id, roles: [...roles] } })
    await db.pushSubscription.create({ data: { tenantId, staffId: id, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" } })
  }
  const vacc = await import("./vaccinations")
  await vacc.addScheduleItem("t1", { vaccine: "Lasota", ageDays: 7, method: "eye_drop" })
  const b = await batches.createBatch(
    "t1",
    "owner",
    { name: "Layers", breed: null, purpose: "meat", source: "bought", supplier: null, startDate: "2026-10-01", ageAtStartDays: 1, startCount: 100, eggsSet: null, parentBatchId: null, eggValuePaise: null, note: null, chicksCostPaise: null },
    TODAY
  )
  batchId = b.id
  // A week of 10 kg a day without losses, then 6 birds lost yesterday; 100 kg bought, so 20 kg (2 days) left.
  for (let d = 12; d <= 18; d++) await batches.saveBatchDay("t1", "owner", batchId, day(`2026-10-${d}`), TODAY)
  await batches.saveBatchDay("t1", "owner", batchId, day("2026-10-19", { losses: [{ cause: "disease", count: 6 }] }), TODAY)
  await tenantDb("t1").expense.create({ data: { tenantId: "t1", date: "2026-10-10", kind: "feed", amountPaise: 300_000, quantityKg: 100 } })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

beforeEach(() => {
  sent.length = 0
})

describe("poultry reminders", () => {
  it("in the morning tells the owner and packing staff of the late vaccine and the warnings", async () => {
    const r = await reminders.morningReminders(MORNING)
    expect(r).toEqual([{ slug: "t1", vaccines: 1, warnings: 2 }])
    expect(phones()).toEqual(["owner", "owner", "packing", "packing"])
    const notes = sent.filter((s) => s.endpoint.endsWith("/owner")).map((s) => s.note)
    expect(notes.find((n) => n.tag === "vaccines-due")).toMatchObject({ title: "தடுப்பூசி · 1 vaccine due · தாமதம் / late", body: "Lasota (Layers)", url: "/farm/poultry/vaccines" })
    expect(notes.find((n) => n.tag === "warnings")?.body).toBe("Layers: 6 இழப்பு / Layers: 6 lost · தீவனம் 2 நாள் / feed for 2 days")
  })

  it("in the evening reminds them of a batch not entered today, and stays quiet once it is", async () => {
    expect(await reminders.eveningReminders(EVENING)).toEqual([{ slug: "t1", notEntered: 1 }])
    expect(phones()).toEqual(["owner", "packing"])
    expect(sent[0].note).toMatchObject({ title: "இன்றைய பதிவு இல்லை · 1 batch not entered", url: "/farm/poultry/entry?batch=all" })

    sent.length = 0
    await batches.saveBatchDay("t1", "owner", batchId, day(TODAY), TODAY)
    expect(await reminders.eveningReminders(EVENING)).toEqual([{ slug: "t1", notEntered: 0 }])
    expect(sent).toEqual([])
  })

  it("shows the same warnings on Today; once today is entered, only today.s losses count", async () => {
    const alerts = await reminders.alertsFor("t1", TODAY)
    expect(alerts.map((a) => a.kind)).toEqual(["feed"])
    expect(alerts[0]).toMatchObject({ daysLeft: 1, leftKg: 10 })
  })
})
