/**
 * End-to-end test of the order service against a real Postgres (PGlite over a local socket),
 * using the same Prisma client, tenant scoping and transactions as the app.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54329
const NOW = new Date("2026-10-21T10:00:00Z") // Wed 15:30 IST
const TOMORROW_AM = "2026-10-22|slot-am"

let pg: PGlite
let server: PGLiteSocketServer
let svc: typeof import("./orders")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let prisma: typeof import("@/lib/prisma").prisma

const tenantRow = (id: string, slug: string) => ({
  id,
  slug,
  nameTa: slug,
  nameEn: slug,
  status: "active" as const,
  plan: "free" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000020001",
  upiId: null,
  gstin: null,
  fssaiNo: null,
  invoicePrefix: "MF",
  whatsappMode: "lite" as const,
  whatsappNumber: null,
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  whatsappWabaId: null,
  deliveryFeePaise: 3000,
  freeAbovePaise: 50_000,
  trialEndsAt: null,
  createdAt: NOW,
  updatedAt: NOW,
})
const merry = tenantRow("t1", "merryfarms")
const other = tenantRow("t2", "otherfarm")

const order = (over: Partial<import("./orders").PlaceOrderInput> = {}): import("./orders").PlaceOrderInput => ({
  channel: "web",
  customer: { phone: "+919000010001", name: "Priya", language: "ta" },
  address: { line: "12, Lake View Road" },
  items: [{ productId: "p-eggs", qty: 2 }],
  slotKey: TOMORROW_AM,
  paymentMethod: "upi_on_delivery",
  ...over,
})

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`

  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  svc = await import("./orders")

  await prisma.tenant.createMany({ data: [merry, other] })
  for (const t of [merry, other]) {
    const db = tenantDb(t.id)
    await db.category.create({ data: { id: `${t.id}-cat`, tenantId: t.id, nameTa: "முட்டை", nameEn: "Eggs" } })
    await db.deliverySlot.create({
      data: { id: t.id === "t1" ? "slot-am" : "slot-am-2", tenantId: t.id, nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 3 },
    })
  }
  const db = tenantDb(merry.id)
  await db.product.create({
    data: { id: "p-eggs", tenantId: merry.id, categoryId: "t1-cat", nameTa: "முட்டை", nameEn: "Eggs", packTa: "30", packEn: "Tray of 30", pricePaise: 39_000, stockQty: 10 },
  })
  await tenantDb(other.id).product.create({
    data: { id: "p-other", tenantId: other.id, categoryId: "t2-cat", nameTa: "பால்", nameEn: "Milk", packTa: "1 L", packEn: "1 L", pricePaise: 9_000, stockQty: 10 },
  })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("placing orders", () => {
  it("creates a priced order that waits for a call, and reduces stock", async () => {
    const { order: o, decision } = await svc.placeOrder(merry, order(), NOW)
    expect(o).toMatchObject({ number: 1001, status: "to_confirm", subtotalPaise: 78_000, deliveryFeePaise: 0, totalPaise: 78_000, slotLabel: "7–9 AM", slotDate: "2026-10-22" })
    expect(decision).toEqual({ needsCall: true, reason: "new_customer" })
    expect((await tenantDb(merry.id).product.findFirst({ where: { id: "p-eggs" } }))!.stockQty).toBe(8)
  })

  it("numbers orders in sequence and reuses the customer by phone", async () => {
    const { order: o } = await svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 1 }] }), NOW)
    expect(o.number).toBe(1002)
    expect(o.deliveryFeePaise).toBe(3000) // ₹390 is below the ₹500 free-delivery line
    expect(o.totalPaise).toBe(42_000)
    expect(await tenantDb(merry.id).customer.count()).toBe(1)
  })

  it("rejects more than the stock left", async () => {
    await expect(svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 99 }] }), NOW)).rejects.toThrow("out_of_stock")
  })

  it("closes a slot once it reaches its order limit", async () => {
    await svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 1 }] }), NOW) // 3rd order = max
    await expect(svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 1 }] }), NOW)).rejects.toThrow("slot_full")
  })

  it("never lets one farm order another farm's product", async () => {
    await expect(
      svc.placeOrder(other, order({ items: [{ productId: "p-eggs", qty: 1 }], slotKey: "2026-10-22|slot-am-2" }), NOW)
    ).rejects.toThrow("product_unavailable")
  })
})

describe("tenant isolation", () => {
  it("hides one farm's orders and customers from another", async () => {
    expect(await tenantDb(other.id).order.count()).toBe(0)
    expect(await tenantDb(other.id).customer.findFirst({ where: { phone: "+919000010001" } })).toBeNull()
  })

  it("cannot update another farm's rows", async () => {
    const r = await tenantDb(other.id).product.updateMany({ where: { id: "p-eggs" }, data: { pricePaise: 1 } })
    expect(r.count).toBe(0)
    expect((await tenantDb(merry.id).product.findFirst({ where: { id: "p-eggs" } }))!.pricePaise).toBe(39_000)
  })
})

describe("confirmation calls", () => {
  it("retries unanswered calls, then hands the order to the owner", async () => {
    const first = await tenantDb(merry.id).order.findFirst({ where: { number: 1001 } })
    for (const attempt of [1, 2]) {
      const r = await svc.recordCall(merry.id, first!.id, "no_answer", "staff-1")
      expect(r).toMatchObject({ attempt, retry: true, needsOwner: false })
    }
    const third = await svc.recordCall(merry.id, first!.id, "no_answer", "staff-1")
    expect(third).toMatchObject({ attempt: 3, retry: false, needsOwner: true })
    expect((await tenantDb(merry.id).order.findFirst({ where: { id: first!.id } }))!.status).toBe("to_confirm")
  })

  it("confirms on yes and records the full history", async () => {
    const o = await tenantDb(merry.id).order.findFirst({ where: { number: 1002 } })
    await svc.recordCall(merry.id, o!.id, "confirmed", "staff-1")
    const after = await tenantDb(merry.id).order.findFirst({ where: { id: o!.id }, include: { events: { orderBy: { at: "asc" } } } })
    expect(after!.status).toBe("confirmed")
    expect(after!.events.map((e) => e.toStatus)).toEqual(["to_confirm", "confirmed"])
    await expect(svc.recordCall(merry.id, o!.id, "confirmed", "staff-1")).rejects.toThrow("not_waiting_for_call")
  })

  it("puts stock back when an order is cancelled", async () => {
    const db = tenantDb(merry.id)
    const before = (await db.product.findFirst({ where: { id: "p-eggs" } }))!.stockQty
    const o = await db.order.findFirst({ where: { number: 1001 } }) // 2 eggs trays
    await svc.recordCall(merry.id, o!.id, "cancelled", "staff-1")
    expect((await db.product.findFirst({ where: { id: "p-eggs" } }))!.stockQty).toBe(before + 2)
    await expect(svc.setOrderStatus(merry.id, o!.id, "delivered", "staff-1")).rejects.toThrow("bad_transition")
  })
})
