/**
 * The Entry page's one Save against a real Postgres (PGlite over a local socket): the day, a weighing and doses in
 * one go, stopping at the first part that fails (and saying so), never giving another batch's dose, staying inside
 * the farm, and one audit line per Save.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54363
const TODAY = "2026-10-20"

let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let entry: typeof import("./poultry-entry")
let vaccinations: typeof import("./vaccinations")
let batchId: string
let otherBatchId: string

const actor = { kind: "staff" as const, id: "s1", name: "Packer" }

const tenantRow = (id: string) => ({
  id,
  slug: id,
  nameTa: id,
  nameEn: id,
  status: "active" as const,
  plan: "pro" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000040001",
  invoicePrefix: "MF",
  whatsappMode: "lite" as const,
  deliveryFeePaise: 0,
  freeAbovePaise: 0,
  features: { poultryCare: true },
})

const day = (feedKg: number, lost = 0) => ({ feedKg, eggsCollected: null, eggsBroken: null, sold: 0, soldPaise: 0, given: 0, note: null, losses: lost ? [{ cause: "disease", count: lost }] : [] })

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  entry = await import("./poultry-entry")
  vaccinations = await import("./vaccinations")
  await prisma.tenant.createMany({ data: [tenantRow("t1"), tenantRow("t2")] })
  const batches = await import("./batches")
  const make = (name: string) =>
    batches.createBatch(
      "t1",
      "s1",
      { name, breed: null, purpose: "meat", source: "bought", supplier: null, startDate: "2026-10-01", ageAtStartDays: 1, startCount: 100, eggsSet: null, parentBatchId: null, eggValuePaise: null, note: null, chicksCostPaise: null },
      TODAY
    )
  batchId = (await make("Broilers")).id
  otherBatchId = (await make("Country")).id
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

const plan = async (batch: string, vaccine: string, dueDate: string) => {
  await vaccinations.addDose("t1", "s1", batch, { vaccine, method: null, dueDate, givenDate: null, birds: null, costPaise: null, note: null }, TODAY)
  return (await tenantDb("t1").batchVaccination.findFirst({ where: { batchId: batch, vaccine } }))!.id
}

describe("the Entry page's one Save", () => {
  it("saves the day, a weighing, a planned dose and an unplanned one together, with one audit line", async () => {
    const lasota = await plan(batchId, "Lasota", "2026-10-19")
    const res = await entry.saveBatchEntry(
      "t1",
      actor,
      batchId,
      {
        date: TODAY,
        day: day(12, 2),
        weight: { birds: 10, totalGrams: 9000, note: null },
        give: [{ doseId: lasota, birds: 98, costPaise: undefined }],
        newDose: { vaccine: "Vitamin", method: "water", birds: 98, costPaise: null },
      },
      TODAY
    )
    expect(res).toEqual({ saved: ["day", "weight", "dose"], failed: null })
    const db = tenantDb("t1")
    expect(await db.batchDay.findFirst({ where: { batchId, date: TODAY }, select: { feedKg: true } })).toEqual({ feedKg: 12 })
    expect(await db.batchLoss.count({ where: { batchId, date: TODAY } })).toBe(1)
    expect(await db.batchWeight.count({ where: { batchId, date: TODAY } })).toBe(1)
    const doses = await db.batchVaccination.findMany({ where: { batchId }, orderBy: { vaccine: "asc" }, select: { vaccine: true, dueDate: true, givenDate: true, birds: true } })
    expect(doses).toEqual([
      { vaccine: "Lasota", dueDate: "2026-10-19", givenDate: TODAY, birds: 98 },
      { vaccine: "Vitamin", dueDate: null, givenDate: TODAY, birds: 98 },
    ])
    const audit = await prisma.auditEntry.findMany({ where: { action: "poultry.entry" } })
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ tenantId: "t1", subject: batchId, actorId: "s1", after: { date: TODAY, saved: ["day", "weight", "dose"], doses: 2 } })
  })

  it("stops at the first part that fails and says which: the day is saved, the bad weighing and the dose are not", async () => {
    const gumboro = await plan(batchId, "Gumboro", "2026-10-18")
    const res = await entry.saveBatchEntry(
      "t1",
      actor,
      batchId,
      { date: "2026-10-19", day: day(11), weight: { birds: 10, totalGrams: 46, note: null }, give: [{ doseId: gumboro, birds: null, costPaise: undefined }] },
      TODAY
    )
    expect(res).toEqual({ saved: ["day"], failed: { part: "weight", code: "weight_odd" } })
    const db = tenantDb("t1")
    expect(await db.batchDay.count({ where: { batchId, date: "2026-10-19" } })).toBe(1)
    expect(await db.batchWeight.count({ where: { batchId, date: "2026-10-19" } })).toBe(0)
    expect((await db.batchVaccination.findFirst({ where: { id: gumboro } }))?.givenDate).toBeNull()
  })

  it("never gives another batch's dose from this batch's Entry", async () => {
    const theirs = await plan(otherBatchId, "Marek", "2026-10-15")
    const res = await entry.saveBatchEntry("t1", actor, batchId, { date: TODAY, give: [{ doseId: theirs, birds: 50, costPaise: undefined }] }, TODAY)
    expect(res).toEqual({ saved: [], failed: { part: "dose", code: "vaccine_not_found" } })
    expect((await tenantDb("t1").batchVaccination.findFirst({ where: { id: theirs } }))?.givenDate).toBeNull()
  })

  it("stays inside the farm, and a Save with nothing in it saves nothing and writes no audit line", async () => {
    await expect(entry.saveBatchEntry("t2", { ...actor, id: "x" }, batchId, { date: TODAY, day: day(5) }, TODAY)).rejects.toMatchObject({ code: "batch_not_found" })
    const before = await prisma.auditEntry.count()
    expect(await entry.saveBatchEntry("t1", actor, batchId, { date: TODAY }, TODAY)).toEqual({ saved: [], failed: null })
    expect(await prisma.auditEntry.count()).toBe(before)
  })
})
