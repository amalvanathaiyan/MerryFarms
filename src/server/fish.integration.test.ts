/**
 * Fishery against a real Postgres (PGlite over a local socket): a cycle starts in a free pond with its first fish,
 * fingerlings bought become spending on the pond, the day's feed comes out of the store (and follows changes), fish
 * found dead can't be more than are left, samples give the size, closing frees the pond, and farms stay apart.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54383
const TODAY = "2026-11-15"
const POND = "00000000-0000-4000-8000-0000000000a1"
const SHED = "00000000-0000-4000-8000-0000000000b1"
const FEED = "00000000-0000-4000-8000-0000000000f1"
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let fish: typeof import("./fish")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb

const stocking = (over: Partial<import("./fish").StockingForm> = {}): import("./fish").StockingForm => ({ date: "2026-09-01", species: "rohu", count: 2000, sizeGrams: 10, costPaise: 400_000, supplier: "Bhavani hatchery", ...over })
const day = (over: Partial<import("./fish").FishDayForm> = {}): import("./fish").FishDayForm => ({ date: TODAY, feedKg: 20, feedInputId: FEED, dead: 0, ph: null, oxygen: null, tempC: null, ammonia: null, note: null, ...over })

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T04:00:00Z`))
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  fish = await import("./fish")
  await prisma.tenant.createMany({
    data: ["f1", "f2"].map((id) => ({ id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan: "pro" as const, phone: "+919000090001", invoicePrefix: "TF" })),
  })
  await prisma.farmPlace.createMany({
    data: [
      { id: POND, tenantId: "f1", kind: "pond", name: "Big pond" },
      { id: SHED, tenantId: "f1", kind: "shed", name: "Shed" },
    ],
  })
  await prisma.farmInput.create({ data: { id: FEED, tenantId: "f1", name: "Fish feed", kind: "feed", unit: "kg" } })
}, 60_000)

afterAll(async () => {
  vi.useRealTimers()
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("fishery", () => {
  let cycleId = ""
  let next = ""

  it("starts a cycle only in a free pond, and books the fingerlings as spending on it", async () => {
    const db = tenantDb("f1")
    await expect(fish.startCycle(db, "f1", { placeId: SHED, note: null, stocking: stocking() }, "owner")).rejects.toThrow("not_found")
    await expect(fish.startCycle(db, "f1", { placeId: POND, note: null, stocking: stocking({ date: "2026-12-01" }) }, "owner")).rejects.toThrow("record_future")
    cycleId = await fish.startCycle(db, "f1", { placeId: POND, note: null, stocking: stocking() }, "owner")
    await expect(fish.startCycle(db, "f1", { placeId: POND, note: null, stocking: stocking() }, "owner")).rejects.toThrow("pond_busy")
    await fish.addStocking(db, "f1", cycleId, stocking({ species: "catla", count: 1000, costPaise: 250_000, supplier: null }), "owner")
    const spent = await prisma.expense.findMany({ where: { tenantId: "f1" }, orderBy: { amountPaise: "desc" } })
    expect(spent.map((e) => [e.kind, e.amountPaise, e.placeId, e.note])).toEqual([
      ["seeds", 400_000, POND, "rohu × 2000 · Bhavani hatchery"],
      ["seeds", 250_000, POND, "catla × 1000"],
    ])
    expect(await prisma.fishCycle.findUniqueOrThrow({ where: { id: cycleId } })).toMatchObject({ number: 1, startDate: "2026-09-01" })
  })

  it("takes the day's feed out of the store on the pond, and follows changes to it", async () => {
    const db = tenantDb("f1")
    await fish.saveFishDay(db, "f1", cycleId, day({ dead: 12, ph: 7.2, oxygen: 3.5 }), "packer")
    let uses = await prisma.inputUse.findMany({ where: { inputId: FEED } })
    expect(uses.map((u) => [u.quantity, u.placeId, u.date])).toEqual([[20, POND, TODAY]])
    // Same day again: one day, one use, new amount.
    await fish.saveFishDay(db, "f1", cycleId, day({ feedKg: 25, dead: 10, ph: 7.2, oxygen: 3.5 }), "packer")
    uses = await prisma.inputUse.findMany({ where: { inputId: FEED } })
    expect(uses.map((u) => u.quantity)).toEqual([25])
    expect(await prisma.fishDay.count({ where: { cycleId } })).toBe(1)
    // Not from the store any more: the use goes.
    await fish.saveFishDay(db, "f1", cycleId, day({ date: "2026-11-14", feedKg: 18, feedInputId: null }), "packer")
    await fish.saveFishDay(db, "f1", cycleId, day({ feedKg: 25, feedInputId: null, dead: 10 }), "packer")
    expect(await prisma.inputUse.count({ where: { inputId: FEED } })).toBe(0)
    await fish.saveFishDay(db, "f1", cycleId, day({ feedKg: 25, dead: 10, oxygen: 3.5 }), "packer")
    expect(await prisma.inputUse.count({ where: { inputId: FEED } })).toBe(1)
    await expect(fish.saveFishDay(db, "f1", cycleId, day({ date: "2026-08-01" }), "packer")).rejects.toThrow("before_start")
    await expect(fish.saveFishDay(db, "f1", cycleId, day({ date: "2026-11-13", dead: 2991 }), "packer")).rejects.toThrow("too_many_dead")
    await expect(fish.saveFishDay(db, "f1", cycleId, day({ ph: 75 }), "packer")).rejects.toThrow("invalid_form")
  })

  it("adds up the pond: fish left, size from the latest sample, weight and feed per kg, water warnings", async () => {
    const db = tenantDb("f1")
    await fish.addSample(db, "f1", cycleId, { date: "2026-11-10", species: null, count: 10, totalGrams: 2500 }, "packer")
    const book = await fish.fishBook(db, TODAY)
    expect(book.freePonds).toEqual([])
    const c = book.open[0]
    expect(c).toMatchObject({ pond: "Big pond", stocked: 3000, dead: 10, left: 2990, feedKg: 43, average: { date: "2026-11-10", grams: 250 }, enteredToday: true })
    expect(c.weight).toEqual({ kg: 747.5, fcr: 0.06 })
    expect(c.lastWater?.warnings.map((w) => [w.check, w.danger])).toEqual([["oxygen", false]])
    expect(c.mix).toEqual([
      { species: "rohu", count: 2000 },
      { species: "catla", count: 1000 },
    ])
  })

  it("closes the cycle to free the pond, and keeps farms apart", async () => {
    const db = tenantDb("f1")
    await expect(fish.closeCycle(tenantDb("f2"), cycleId, TODAY)).rejects.toThrow("not_found")
    expect((await fish.fishBook(tenantDb("f2"), TODAY)).open).toEqual([])
    await fish.closeCycle(db, cycleId, TODAY)
    await expect(fish.saveFishDay(db, "f1", cycleId, day(), "packer")).rejects.toThrow("cycle_closed")
    const book = await fish.fishBook(db, TODAY)
    expect(book.freePonds.map((p) => p.name)).toEqual(["Big pond"])
    expect(book.closed.map((c) => c.number)).toEqual([1])
    next = await fish.startCycle(db, "f1", { placeId: POND, note: null, stocking: stocking({ date: TODAY }) }, "owner")
    expect((await prisma.fishCycle.findUniqueOrThrow({ where: { id: next } })).number).toBe(2)
    await expect(fish.reopenCycle(db, cycleId)).rejects.toThrow("pond_busy")
  })

  it("removes a later stocking with its spending, never the only one", async () => {
    const db = tenantDb("f1")
    const old = await prisma.fishStocking.findFirstOrThrow({ where: { cycleId } })
    await expect(fish.removeStocking(db, old.id)).rejects.toThrow("cycle_closed")
    await fish.addStocking(db, "f1", next, stocking({ date: TODAY, species: "catla", count: 500 }), "owner")
    const [first, second] = await prisma.fishStocking.findMany({ where: { cycleId: next }, orderBy: { count: "desc" } })
    await expect(fish.removeStocking(db, "nope")).rejects.toThrow("not_found")
    await fish.removeStocking(db, second.id)
    expect(await prisma.expense.count({ where: { id: second.expenseId! } })).toBe(0)
    await expect(fish.removeStocking(db, first.id)).rejects.toThrow("last_stocking")
  })

  it("takes fish out, works out the cycle's money from what was spent on the pond, and closes on the last harvest", async () => {
    const db = tenantDb("f1")
    // Fish feed bought at ₹50 a kg; 10 kg given to the new cycle today. The old cycle's 25 kg today stays with it.
    await prisma.expense.create({ data: { tenantId: "f1", date: "2026-11-01", kind: "feed", amountPaise: 500_000, inputId: FEED, quantity: 100 } })
    await fish.saveFishDay(db, "f1", next, day({ feedKg: 10, oxygen: 2 }), "packer")
    // A worker at the pond today (₹500 a day).
    const w = await prisma.worker.create({ data: { tenantId: "f1", name: "Raju", payType: "daily", ratePaise: 50_000 } })
    await prisma.workerDay.create({ data: { tenantId: "f1", workerId: w.id, date: TODAY, state: "present", placeId: POND } })
    await expect(fish.addHarvest(db, "f1", next, { date: TODAY, species: null, kg: 10, count: 5000, soldPaise: 0, buyer: null }, "owner", false)).rejects.toThrow("too_many_fish")
    await fish.addHarvest(db, "f1", next, { date: TODAY, species: "rohu", kg: 300, count: 1000, soldPaise: 4_500_000, buyer: "Market" }, "owner", false)
    const c = await prisma.fishCycle.findUniqueOrThrow({ where: { id: next }, include: { harvests: true } })
    expect(await fish.cycleMoneyFor(db, c, c.harvests, TODAY)).toEqual({ income: 4_500_000, costs: 400_000 + 50_000 + 50_000, profit: 4_000_000, costPerKgPaise: 1667 })
    const d = await fish.cycleDetail(db, next, TODAY)
    expect(d).toMatchObject({ stocked: 2000, harvested: 1000, left: 1000, harvestKg: 300 })
    // The water is bad today: a reminder (no size check due yet, the cycle is a day old).
    expect((await fish.fishRemindersFor(db, TODAY)).map((r) => [r.kind, r.pond])).toEqual([["water", "Big pond"]])
    // The last of them: the cycle closes on that day.
    await fish.addHarvest(db, "f1", next, { date: TODAY, species: null, kg: 280, count: null, soldPaise: 0, buyer: null }, "owner", true)
    expect((await prisma.fishCycle.findUniqueOrThrow({ where: { id: next } })).closedDate).toBe(TODAY)
    expect(await fish.fishRemindersFor(db, TODAY)).toEqual([])
    const h = await prisma.fishHarvest.findFirstOrThrow({ where: { cycleId: next, soldPaise: 0 } })
    await expect(fish.removeHarvest(db, h.id)).rejects.toThrow("cycle_closed")
  })

  it("runs the migration safely twice", async () => {
    const migration = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-15-fishery.sql"), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    expect(await prisma.fishCycle.count()).toBe(2)
    expect(await prisma.fishHarvest.count()).toBe(2)
  })
})
