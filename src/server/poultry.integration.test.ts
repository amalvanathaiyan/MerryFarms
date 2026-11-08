/**
 * Batches and vaccinations against a real Postgres (PGlite over a local socket), with the app's Prisma client,
 * tenant scoping and transactions: saving days and losses, the feed store and batch money, the vaccine plan,
 * and dose costs becoming expenses.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54331
const TODAY = "2026-10-20"
const T1 = "t1"
const T2 = "t2"

let pg: PGlite
let server: PGLiteSocketServer
let batches: typeof import("./batches")
let vacc: typeof import("./vaccinations")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let prisma: typeof import("@/lib/prisma").prisma

const tenantRow = (id: string) => ({
  id,
  slug: id,
  nameTa: id,
  nameEn: id,
  status: "active" as const,
  plan: "pro" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000020001",
  invoicePrefix: "MF",
  whatsappMode: "lite" as const,
  deliveryFeePaise: 0,
  freeAbovePaise: 0,
  features: { poultryCare: true },
})

const input = (over: Partial<import("./batches").BatchInput> = {}): import("./batches").BatchInput & { chicksCostPaise: number | null } => ({
  name: "",
  breed: null,
  purpose: "eggs",
  source: "bought",
  supplier: "Hatchery",
  // Came 1 Oct at 3 days old, so hatched 28 Sep.
  startDate: "2026-10-01",
  ageAtStartDays: 3,
  startCount: 100,
  eggsSet: null,
  parentBatchId: null,
  eggValuePaise: null,
  note: null,
  chicksCostPaise: 500_000,
  ...over,
})

const day = (date: string, over: Partial<import("./batches").BatchDayInput> = {}): import("./batches").BatchDayInput => ({
  date,
  feedKg: null,
  eggsCollected: null,
  eggsBroken: null,
  sold: 0,
  soldPaise: 0,
  given: 0,
  note: null,
  losses: [],
  ...over,
})

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as { code?: string }).code ?? String(e)
  }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  batches = await import("./batches")
  vacc = await import("./vaccinations")
  await prisma.tenant.createMany({ data: [tenantRow(T1), tenantRow(T2)] })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("a batch from arrival to profit", () => {
  let id: string

  it("numbers the batch, books the chicks as its expense and copies the doses still ahead from the plan", async () => {
    await vacc.addScheduleItem(T1, { vaccine: "Marek", ageDays: 1, method: "injection" })
    await vacc.addScheduleItem(T1, { vaccine: "Lasota", ageDays: 7, method: "eye_drop" })
    await vacc.addScheduleItem(T1, { vaccine: "Gumboro", ageDays: 14, method: "water" })
    expect(await code(vacc.addScheduleItem(T1, { vaccine: " lasota ", ageDays: 7, method: null }))).toBe("vaccine_in_plan")
    const b =await batches.createBatch(T1, "s1", input(), TODAY)
    id = b.id
    expect(b.number).toBe(1)
    expect(b.name).toBe("#1")

    const db = tenantDb(T1)
    const expenses = await db.expense.findMany({ where: { batchId: id } })
    expect(expenses.map((e) => [e.kind, e.amountPaise, e.date])).toEqual([["chicks", 500_000, "2026-10-01"]])

    // Marek (day 1) was before the birds came at 3 days old.
    const doses = await db.batchVaccination.findMany({ where: { batchId: id }, orderBy: { dueDate: "asc" } })
    expect(doses.map((d) => [d.vaccine, d.dueDate, d.givenDate])).toEqual([
      ["Lasota", "2026-10-05", null],
      ["Gumboro", "2026-10-12", null],
    ])
  })

  it("saves a day with losses by cause, and saving it again replaces them", async () => {
    await batches.saveBatchDay(T1, "s1", id, day("2026-10-02", { feedKg: 5, losses: [{ cause: "disease", count: 2 }, { cause: "heat", count: 1 }] }), TODAY)
    await batches.saveBatchDay(T1, "s1", id, day("2026-10-02", { feedKg: 6, losses: [{ cause: "disease", count: 3 }] }), TODAY)
    await batches.saveBatchDay(T1, "s1", id, day("2026-10-03", { feedKg: 6, sold: 10, soldPaise: 300_000 }), TODAY)
    const db = tenantDb(T1)
    expect(await db.batchDay.count({ where: { batchId: id } })).toBe(2)
    expect((await db.batchLoss.findMany({ where: { batchId: id } })).map((l) => [l.cause, l.count])).toEqual([["disease", 3]])
  })

  it("keeps the time a loss was first entered when the day is saved again, and moves the day's last-changed time", async () => {
    const db = tenantDb(T1)
    const first = await db.batchLoss.findFirstOrThrow({ where: { batchId: id, date: "2026-10-02", cause: "disease" } })
    const dayBefore = await db.batchDay.findFirstOrThrow({ where: { batchId: id, date: "2026-10-02" } })
    await new Promise((r) => setTimeout(r, 20))
    await batches.saveBatchDay(T1, "s1", id, day("2026-10-02", { feedKg: 6, losses: [{ cause: "disease", count: 4 }, { cause: "predator", count: 1 }] }), TODAY)
    const losses = await db.batchLoss.findMany({ where: { batchId: id, date: "2026-10-02" } })
    const disease = losses.find((l) => l.cause === "disease")!
    const predator = losses.find((l) => l.cause === "predator")!
    expect(disease.count).toBe(4)
    expect(disease.createdAt).toEqual(first.createdAt)
    expect(predator.createdAt.getTime()).toBeGreaterThan(first.createdAt.getTime())
    const dayAfter = await db.batchDay.findFirstOrThrow({ where: { batchId: id, date: "2026-10-02" } })
    expect(dayAfter.createdAt).toEqual(dayBefore.createdAt)
    expect(dayAfter.updatedAt.getTime()).toBeGreaterThan(dayBefore.updatedAt.getTime())
    // Back to how the rest of these tests expect the day.
    await batches.saveBatchDay(T1, "s1", id, day("2026-10-02", { feedKg: 6, losses: [{ cause: "disease", count: 3 }] }), TODAY)
  })

  it("refuses more birds out than the batch has, days before it came and days in the future", async () => {
    expect(await code(batches.saveBatchDay(T1, "s1", id, day("2026-10-04", { sold: 90 }), TODAY))).toBe("more_out_than_birds")
    expect(await code(batches.saveBatchDay(T1, "s1", id, day("2026-09-30"), TODAY))).toBe("batch_before_start")
    expect(await code(batches.saveBatchDay(T1, "s1", id, day("2026-10-21"), TODAY))).toBe("record_future")
  })

  it("prices the feed eaten from feed bought by the kg, and works out the batch's money", async () => {
    // 100 kg for ₹4,000: ₹40/kg. Feed is never put on a batch; the batch pays for what it ate.
    await tenantDb(T1).expense.create({ data: { tenantId: T1, date: "2026-10-01", kind: "feed", amountPaise: 400_000, quantityKg: 100 } })
    const book = await batches.batchBook(T1, TODAY)
    expect(book.feed).toEqual({ boughtKg: 100, usedKg: 12, leftKg: 88, pricePerKgPaise: 4000 })
    const row = book.rows.find((r) => r.batch.id === id)!
    expect(row.status.alive).toBe(87)
    expect(row.money.feedPaise).toBe(48_000)
    expect(row.money.costPaise).toBe(548_000)
    expect(row.money.marginPaise).toBe(300_000 - 548_000)
  })

  it("won't delete a batch with days entered, or close it before its last entry", async () => {
    expect(await code(batches.deleteBatch(T1, id))).toBe("batch_confirm_name")
    expect(await code(batches.deleteBatch(T1, id, { confirmName: "Batch 1" }))).toBe("batch_confirm_name")
    expect(await code(batches.setBatchClosed(T1, id, "2026-10-02", TODAY))).toBe("batch_entries_after_close")
  })
})

describe("vaccinations", () => {
  let batchId: string
  let lasota: string

  beforeAll(async () => {
    batchId = (await tenantDb(T1).batch.findFirstOrThrow({ where: { number: 1 } })).id
    lasota = (await tenantDb(T1).batchVaccination.findFirstOrThrow({ where: { batchId, vaccine: "Lasota" } })).id
  })

  const doseExpense = async (doseId: string) => {
    const dose = await tenantDb(T1).batchVaccination.findFirstOrThrow({ where: { id: doseId } })
    return dose.expenseId ? tenantDb(T1).expense.findFirst({ where: { id: dose.expenseId } }) : null
  }

  it("marks a dose given and books its cost as medicine on the batch", async () => {
    await vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-05", birds: 95, costPaise: 25_000, note: null }, TODAY)
    const e = await doseExpense(lasota)
    expect([e?.kind, e?.amountPaise, e?.batchId, e?.date, e?.note]).toEqual(["medicine", 25_000, batchId, "2026-10-05", "Lasota"])
    const row = (await batches.batchBook(T1, TODAY)).rows.find((r) => r.batch.id === batchId)!
    expect(row.money.otherPaise).toBe(25_000)
  })

  it("keeps the cost when staff (who can't see money) change the day, and follows the new day", async () => {
    await vacc.giveDose(T1, "s2", lasota, { givenDate: "2026-10-06", birds: 95, costPaise: undefined, note: null }, TODAY)
    const e = await doseExpense(lasota)
    expect([e?.amountPaise, e?.date]).toEqual([25_000, "2026-10-06"])
  })

  it("changes and removes the cost with the owner's changes", async () => {
    await vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-06", birds: 95, costPaise: 30_000, note: null }, TODAY)
    expect((await doseExpense(lasota))?.amountPaise).toBe(30_000)
    expect(await tenantDb(T1).expense.count({ where: { kind: "medicine" } })).toBe(1)
    await vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-06", birds: 95, costPaise: null, note: null }, TODAY)
    expect(await doseExpense(lasota)).toBeNull()
    expect(await tenantDb(T1).expense.count({ where: { kind: "medicine" } })).toBe(0)
  })

  it("'not given' puts a planned dose back to planned and removes its cost", async () => {
    await vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-06", birds: 95, costPaise: 30_000, note: null }, TODAY)
    await vacc.undoDose(T1, lasota)
    const d = await tenantDb(T1).batchVaccination.findFirstOrThrow({ where: { id: lasota } })
    expect([d.givenDate, d.birds, d.expenseId, d.dueDate]).toEqual([null, null, null, "2026-10-05"])
    expect(await tenantDb(T1).expense.count({ where: { kind: "medicine" } })).toBe(0)
  })

  it("adds a one-off dose already given, with its cost; 'not given' on it removes it", async () => {
    await vacc.addDose(T1, "s1", batchId, { vaccine: "Fowl pox", method: "wing_stab", dueDate: null, givenDate: "2026-10-10", birds: 80, costPaise: 12_000, note: null }, TODAY)
    const d = await tenantDb(T1).batchVaccination.findFirstOrThrow({ where: { vaccine: "Fowl pox" } })
    expect((await doseExpense(d.id))?.amountPaise).toBe(12_000)
    await vacc.undoDose(T1, d.id)
    expect(await tenantDb(T1).batchVaccination.count({ where: { vaccine: "Fowl pox" } })).toBe(0)
    expect(await tenantDb(T1).expense.count({ where: { kind: "medicine" } })).toBe(0)
  })

  it("refuses doses given in the future, before the batch came, or to more birds than it had", async () => {
    expect(await code(vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-21", birds: 1, costPaise: null, note: null }, TODAY))).toBe("record_future")
    expect(await code(vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-09-30", birds: 1, costPaise: null, note: null }, TODAY))).toBe("batch_before_start")
    expect(await code(vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-05", birds: 101, costPaise: null, note: null }, TODAY))).toBe("vaccine_birds_invalid")
  })

  it("adds the plan to an older batch: only doses from today on, never twice", async () => {
    await tenantDb(T1).vaccineScheduleItem.create({ data: { tenantId: T1, vaccine: "R2B", ageDays: 56, method: "injection" } })
    // Hatched 28 Sep: Lasota (5 Oct) and Gumboro (12 Oct) are past; R2B falls on 23 Nov.
    expect(await vacc.applyScheduleToBatch(T1, batchId, TODAY)).toBe(1)
    expect(await vacc.applyScheduleToBatch(T1, batchId, TODAY)).toBe(0)
    const r2b = await tenantDb(T1).batchVaccination.findFirstOrThrow({ where: { vaccine: "R2B" } })
    expect(r2b.dueDate).toBe("2026-11-23")
  })

  it("keeps each farm's doses to itself", async () => {
    expect(await code(vacc.giveDose(T2, "x", lasota, { givenDate: "2026-10-05", birds: 1, costPaise: 100, note: null }, TODAY))).toBe("vaccine_not_found")
    await vacc.deleteDose(T2, lasota)
    expect(await tenantDb(T1).batchVaccination.count({ where: { id: lasota } })).toBe(1)
    expect(await vacc.loadSchedule(T2)).toEqual([])
  })

  it("deleting a dose takes its cost with it", async () => {
    await vacc.giveDose(T1, "s1", lasota, { givenDate: "2026-10-05", birds: 95, costPaise: 20_000, note: null }, TODAY)
    await vacc.deleteDose(T1, lasota)
    expect(await tenantDb(T1).batchVaccination.count({ where: { id: lasota } })).toBe(0)
    expect(await tenantDb(T1).expense.count({ where: { kind: "medicine" } })).toBe(0)
  })
})

describe("deleting a wrong batch", () => {
  const withEntries = async (name: string, cost: number) => {
    const b = await batches.createBatch(T1, "s1", { ...input({ name }), chicksCostPaise: cost }, TODAY)
    await batches.saveBatchDay(T1, "s1", b.id, day("2026-10-02", { feedKg: 3, losses: [{ cause: "weak", count: 1 }] }), TODAY)
    return b.id
  }

  it("takes the days, losses, doses and its own costs once its name is typed (spaces and capitals don't matter)", async () => {
    const id = await withEntries("Test lot", 300_000)
    const db = tenantDb(T1)
    expect(await db.batchVaccination.count({ where: { batchId: id } })).toBeGreaterThan(0)
    await batches.deleteBatch(T1, id, { confirmName: "  test   LOT " })
    expect(await db.batch.count({ where: { id } })).toBe(0)
    expect(await db.batchDay.count({ where: { batchId: id } })).toBe(0)
    expect(await db.batchLoss.count({ where: { batchId: id } })).toBe(0)
    expect(await db.batchVaccination.count({ where: { batchId: id } })).toBe(0)
    expect(await db.expense.count({ where: { batchId: id } })).toBe(0)
    expect(await db.expense.count({ where: { kind: "chicks", amountPaise: 300_000 } })).toBe(0)
  })

  it("can keep its costs as the farm's when asked", async () => {
    const id = await withEntries("Duplicate", 250_000)
    await batches.deleteBatch(T1, id, { confirmName: "Duplicate", keepCosts: true })
    const kept = await tenantDb(T1).expense.findMany({ where: { kind: "chicks", amountPaise: 250_000 } })
    expect(kept).toHaveLength(1)
    expect(kept[0].batchId).toBeNull()
  })

  it("leaves another farm's batch alone", async () => {
    const id = await withEntries("Mine", 0)
    expect(await code(batches.deleteBatch(T2, id, { confirmName: "Mine" }))).toBe("batch_not_found")
    expect(await tenantDb(T1).batch.count({ where: { id } })).toBe(1)
  })
})

describe("renumbering a batch", () => {
  it("lets a batch take a number freed by deleting a test batch, and refuses one in use", async () => {
    const db = tenantDb(T2)
    const test = await batches.createBatch(T2, "s1", { ...input({ name: "Test" }), chicksCostPaise: null }, TODAY)
    const real = await batches.createBatch(T2, "s1", { ...input(), chicksCostPaise: null }, TODAY)
    expect([test.number, real.number, real.name]).toEqual([1, 2, "#2"])
    const asInput = (b: typeof real) => ({ name: b.name, breed: b.breed, purpose: b.purpose, source: b.source, supplier: b.supplier, startDate: b.startDate, ageAtStartDays: b.ageAtStartDays, startCount: b.startCount, eggsSet: b.eggsSet, parentBatchId: b.parentBatchId, eggValuePaise: b.eggValuePaise, note: b.note })
    expect(await code(batches.updateBatch(T2, real.id, asInput(real), TODAY, 1))).toBe("batch_number_taken")
    await batches.deleteBatch(T2, test.id)
    await batches.updateBatch(T2, real.id, asInput(real), TODAY, 1)
    const after = await db.batch.findFirstOrThrow({ where: { id: real.id } })
    expect([after.number, after.name]).toEqual([1, "#1"])
    const next = await batches.createBatch(T2, "s1", { ...input({ name: "Next" }), chicksCostPaise: null }, TODAY)
    expect(next.number).toBe(2)
  })
})

describe("a batch hatched from bought eggs", () => {
  it("books what was paid for the eggs as the batch's starting cost, noted as hatching eggs", async () => {
    const b = await batches.createBatch(T2, "s1", { ...input({ name: "Hatched lot", source: "eggs_bought", supplier: "Salem farm", ageAtStartDays: 0, startCount: 80, eggsSet: 100 }), chicksCostPaise: 150_000 }, TODAY)
    const e = await tenantDb(T2).expense.findFirstOrThrow({ where: { batchId: b.id } })
    expect([e.kind, e.amountPaise, e.note]).toEqual(["chicks", 150_000, "Hatching eggs · Salem farm"])
    expect(await code(batches.createBatch(T2, "s1", { ...input({ source: "eggs_bought", ageAtStartDays: 0, startCount: 120, eggsSet: 100 }), chicksCostPaise: null }, TODAY))).toBe("hatched_more_than_set")
  })
})

