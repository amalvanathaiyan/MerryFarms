/**
 * The store against a real Postgres (PGlite over a local socket): the migration moves the old feed store in without
 * changing the feed left or its price; buying is spending in Money (deleting it there takes it out of the store);
 * uses and counts put the store right, the hens' feed included; one hen-feed item per farm, and farms stay apart.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54377
const TODAY = "2026-11-12"
const SHED = "00000000-0000-4000-8000-000000000001"
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let inputs: typeof import("./inputs")
let batches: typeof import("./batches")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T06:00:00Z`))
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  inputs = await import("./inputs")
  batches = await import("./batches")
  await prisma.tenant.createMany({
    data: [
      { id: "f1", slug: "f1", nameTa: "f1", nameEn: "f1", phone: "+919000090001", invoicePrefix: "TA" },
      { id: "f2", slug: "f2", nameTa: "f2", nameEn: "f2", phone: "+919000090002", invoicePrefix: "TB", defaultLanguage: "en" },
    ],
  })
  await prisma.farmPlace.create({ data: { id: SHED, tenantId: "f1", kind: "plot", name: "Coconut plot" } })
  // The old feed store: feed bought by the kg (and once without), feed given to a batch
  const b = await prisma.batch.create({ data: { tenantId: "f1", number: 1, name: "Hens", purpose: "eggs", source: "bought", startDate: "2026-11-01", startCount: 100 } })
  await prisma.expense.createMany({
    data: [
      { tenantId: "f1", date: "2026-11-02", kind: "feed", amountPaise: 300_000, quantityKg: 100 },
      { tenantId: "f1", date: "2026-11-03", kind: "feed", amountPaise: 5_000 },
      { tenantId: "f2", date: "2026-11-03", kind: "labour", amountPaise: 5_000 },
    ],
  })
  await prisma.batchDay.create({ data: { tenantId: "f1", batchId: b.id, date: "2026-11-05", feedKg: 40 } })
}, 60_000)

afterAll(async () => {
  vi.useRealTimers()
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

const feedOf = async (tenantId: string) => {
  const book = await batches.batchBook(tenantId, TODAY)
  return { feed: book.feed, feedPaise: book.rows[0]?.money.feedPaise }
}

describe("the store", () => {
  it("moves the old feed store in without changing it", async () => {
    const before = await feedOf("f1")
    expect(before).toEqual({ feed: { boughtKg: 100, usedKg: 40, leftKg: 60, pricePerKgPaise: 3_000 }, feedPaise: 120_000 })
    const sql = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-14-farm-store.sql"), "utf8")
    await pg.exec(sql)
    await pg.exec(sql) // safe twice
    const items = await prisma.farmInput.findMany()
    expect(items).toEqual([expect.objectContaining({ tenantId: "f1", name: "கோழித் தீவனம்", kind: "feed", unit: "kg", batchFeed: true })])
    expect(await prisma.expense.findMany({ where: { inputId: items[0].id }, select: { quantity: true } })).toEqual([{ quantity: 100 }])
    expect(await feedOf("f1")).toEqual(before)
    const list = await inputs.storeList(tenantDb("f1"), TODAY)
    expect(list[0].stock).toMatchObject({ bought: 100, used: 40, left: 60, pricePaise: 3_000 })
  })

  it("buys, uses and counts, the hens' feed too", async () => {
    const db = tenantDb("f1")
    const hen = await inputs.henFeedItem(db, "f1", "x")
    expect(hen).toBe((await prisma.farmInput.findFirstOrThrow()).id)
    await inputs.buyInput(db, "f1", { inputId: hen, date: TODAY, quantity: 50, amountPaise: 160_000, note: null, byStaffId: "s1" })
    expect(await prisma.expense.findFirst({ where: { inputId: hen, date: TODAY } })).toMatchObject({ kind: "feed", quantity: 50, quantityKg: 50 })
    await inputs.takeOutInput(db, "f1", { inputId: hen, date: TODAY, quantity: 5, placeId: null, note: "spilt", byStaffId: "s1" })
    let f = (await feedOf("f1")).feed
    expect(f).toEqual({ boughtKg: 150, usedKg: 40, leftKg: 105, pricePerKgPaise: 3_067 })
    await inputs.countInput(db, "f1", { inputId: hen, counted: 100, byStaffId: "s1" })
    f = (await feedOf("f1")).feed
    expect(f.leftKg).toBe(100)
    // Counting again at the same figure saves nothing
    await inputs.countInput(db, "f1", { inputId: hen, counted: 100, byStaffId: "s1" })
    expect(await prisma.inputUse.count({ where: { kind: "count" } })).toBe(1)

    const urea = await inputs.saveInput(db, "f1", null, { name: " Urea ", kind: "fertiliser", unit: "bag", lowAt: 3, batchFeed: false })
    await inputs.buyInput(db, "f1", { inputId: urea, date: TODAY, quantity: 10, amountPaise: 300_000, note: "50 kg bags", byStaffId: "s1" })
    const bought = await prisma.expense.findFirstOrThrow({ where: { inputId: urea } })
    expect(bought).toMatchObject({ kind: "seeds", quantity: 10, quantityKg: null, note: "Urea · 50 kg bags" })
    await inputs.takeOutInput(db, "f1", { inputId: urea, date: TODAY, quantity: 8, placeId: SHED, note: null, byStaffId: "s1" })
    expect((await inputs.inputsByPlace(db, "2026-01-01")).get(SHED)).toBe(240_000)
    const detail = await inputs.inputDetail(db, urea, TODAY)
    expect(detail?.stock).toMatchObject({ left: 2, pricePaise: 30_000 })
    // Deleting the spending in Money takes it out of the store
    await prisma.expense.delete({ where: { id: bought.id } })
    expect((await inputs.inputDetail(db, urea, TODAY))?.stock.left).toBe(-8)
    await expect(inputs.takeOutInput(db, "f1", { inputId: urea, date: "2026-11-13", quantity: 1, placeId: null, note: null, byStaffId: "s1" })).rejects.toThrow("record_future")
  })

  it("keeps one hen-feed item per farm, and farms apart", async () => {
    const db = tenantDb("f1")
    const other = await inputs.saveInput(db, "f1", null, { name: "Grower", kind: "feed", unit: "kg", lowAt: null, batchFeed: true })
    expect((await prisma.farmInput.findMany({ where: { tenantId: "f1", batchFeed: true } })).map((i) => i.id)).toEqual([other])
    await expect(inputs.saveInput(db, "f1", null, { name: "Bad", kind: "seed", unit: "kg", lowAt: null, batchFeed: true })).rejects.toThrow("invalid_form")
    // Another farm's hen feed doesn't touch this one's
    await inputs.saveInput(tenantDb("f2"), "f2", null, { name: "Feed", kind: "feed", unit: "kg", lowAt: null, batchFeed: true })
    expect(await prisma.farmInput.count({ where: { batchFeed: true } })).toBe(2)
    expect(await inputs.inputDetail(tenantDb("f2"), other, TODAY)).toBeNull()
    const use = await prisma.inputUse.findFirstOrThrow({ where: { tenantId: "f1" } })
    await expect(inputs.removeUse(tenantDb("f2"), use.id)).rejects.toThrow("not_found")
    await inputs.removeUse(db, use.id)
    expect(await prisma.inputUse.count({ where: { id: use.id } })).toBe(0)
  })
})
