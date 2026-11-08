/**
 * The farm's shared egg store against a real Postgres (PGlite over a local socket), through the real order, batch
 * and catalogue code: trays and packs follow the store, orders take eggs out, cancelling puts them back, batch eggs
 * come in, and other products keep their own stock.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54333
const NOW = new Date("2026-10-21T10:00:00Z") // Wed 15:30 IST
const SLOT = "2026-10-22|slot-e"
const T = "t-eggs"

let pg: PGlite
let server: PGLiteSocketServer
let orders: typeof import("./orders")
let stock: typeof import("./stock")
let batches: typeof import("./batches")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let prisma: typeof import("@/lib/prisma").prisma

const farm = {
  id: T,
  slug: "eggfarm",
  nameTa: "eggfarm",
  nameEn: "eggfarm",
  status: "active" as const,
  plan: "pro" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000020001",
  upiId: null,
  gstin: null,
  fssaiNo: null,
  invoicePrefix: "EF",
  whatsappMode: "lite" as const,
  whatsappNumber: null,
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  whatsappWabaId: null,
  deliveryFeePaise: 0,
  freeAbovePaise: 0,
  features: { poultryCare: true },
  farmLat: null as number | null,
  farmLng: null as number | null,
  deliveryRadiusKm: null as number | null,
  servedPincodes: [] as string[],
  logoUrl: null as string | null,
  shopArt: [] as string[],
  trialEndsAt: null,
  eggStore: 0,
  createdAt: NOW,
  updatedAt: NOW,
}

const order = (items: { productId: string; qty: number }[]): import("./orders").PlaceOrderInput => ({
  channel: "phone",
  customer: { phone: "+919000010001", name: "Priya", language: "ta" },
  address: { line: "12, Lake View Road" },
  items,
  slotKey: SLOT,
  paymentMethod: "upi_on_delivery",
  byStaffId: "staff-1",
  staffOverride: true,
})

const stockOf = async () => Object.fromEntries((await tenantDb(T).product.findMany({ select: { id: true, stockQty: true } })).map((p) => [p.id, p.stockQty]))
const store = async () => (await prisma.tenant.findUniqueOrThrow({ where: { id: T } })).eggStore
const tx = <R>(fn: (tx: import("./stock").Tx) => Promise<R>) => tenantDb(T).$transaction(fn)

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  orders = await import("./orders")
  stock = await import("./stock")
  batches = await import("./batches")

  await prisma.tenant.create({ data: farm })
  const db = tenantDb(T)
  await db.category.create({ data: { id: "cat", tenantId: T, nameTa: "முட்டை", nameEn: "Eggs" } })
  await db.deliverySlot.create({ data: { id: "slot-e", tenantId: T, nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 50 } })
  const product = (id: string, packEn: string, eggsPerUnit: number | null, stockQty: number) =>
    db.product.create({ data: { id, tenantId: T, categoryId: "cat", nameTa: id, nameEn: id, packTa: packEn, packEn, pricePaise: 10_000, stockQty, eggsPerUnit, stockUnit: "packs" } })
  await product("tray", "Tray of 30", 30, 0)
  await product("pack", "12 eggs", 12, 0)
  await product("ghee", "500 ml", null, 10)
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("the shared egg store", () => {
  it("sets every egg product's stock from the eggs counted in the store", async () => {
    await tx((t) => stock.setEggStore(t, T, 214))
    expect(await stockOf()).toEqual({ tray: 7, pack: 17, ghee: 10 })
  })

  it("takes 30 eggs per tray sold, and every egg product follows", async () => {
    await orders.placeOrder(farm, order([{ productId: "tray", qty: 2 }]), NOW)
    expect(await store()).toBe(154)
    expect(await stockOf()).toEqual({ tray: 5, pack: 12, ghee: 10 })
  })

  it("won't sell more eggs than the store has, even across products in one order", async () => {
    // 5 trays (150) and 1 pack (12) need 162 eggs; the store has 154.
    await expect(orders.placeOrder(farm, order([{ productId: "tray", qty: 5 }, { productId: "pack", qty: 1 }]), NOW)).rejects.toThrow("out_of_stock")
    expect(await store()).toBe(154)
  })

  it("puts the eggs back when an order is cancelled", async () => {
    const { order: o } = await orders.placeOrder(farm, order([{ productId: "pack", qty: 3 }]), NOW)
    expect(await store()).toBe(118)
    await orders.setOrderStatus(T, o.id, "cancelled", "staff-1")
    expect(await store()).toBe(154)
  })

  it("adds a batch's good eggs, and a corrected day moves only the difference", async () => {
    const b = await batches.createBatch(
      T,
      "staff-1",
      { name: "Layers", breed: null, purpose: "eggs", source: "bought", supplier: null, startDate: "2026-10-01", ageAtStartDays: 150, startCount: 100, eggsSet: null, parentBatchId: null, eggValuePaise: null, note: null, chicksCostPaise: null },
      "2026-10-21"
    )
    const day = { date: "2026-10-20", feedKg: 10, eggsCollected: 40, eggsBroken: 4, sold: 0, soldPaise: 0, given: 0, note: null, losses: [] }
    await batches.saveBatchDay(T, "staff-1", b.id, day, "2026-10-21", true)
    expect(await store()).toBe(190) // + 36 good eggs
    expect(await stockOf()).toMatchObject({ tray: 6, pack: 15 })
    await batches.saveBatchDay(T, "staff-1", b.id, { ...day, eggsCollected: 30, eggsBroken: 0 }, "2026-10-21", true)
    expect(await store()).toBe(184) // 36 taken back, 30 put in
    // Without stock tracking, the store doesn't move.
    await batches.saveBatchDay(T, "staff-1", b.id, { ...day, date: "2026-10-21", eggsCollected: 50 }, "2026-10-21", false)
    expect(await store()).toBe(184)
  })

  it("never lets the store go below zero", async () => {
    await tx((t) => stock.addEggs(t, T, -10_000))
    expect(await store()).toBe(0)
    expect(await stockOf()).toMatchObject({ tray: 0, pack: 0 })
  })

  it("keeps other products on their own stock", async () => {
    await orders.placeOrder(farm, order([{ productId: "ghee", qty: 3 }]), NOW)
    expect(await stockOf()).toMatchObject({ ghee: 7 })
    await expect(orders.placeOrder(farm, order([{ productId: "ghee", qty: 8 }]), NOW)).rejects.toThrow("out_of_stock")
  })
})
