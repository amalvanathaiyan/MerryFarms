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
let billing: typeof import("./billing")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let prisma: typeof import("@/lib/prisma").prisma

const tenantRow = (id: string, slug: string, features: Record<string, boolean> = {}) => ({
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
  features,
  trialEndsAt: null,
  createdAt: NOW,
  updatedAt: NOW,
})
const merry = tenantRow("t1", "merryfarms")
const other = tenantRow("t2", "otherfarm")
// A small farm that doesn't count stock, confirm by call, give credit or issue invoices.
const small = tenantRow("t3", "smallfarm", { stockTracking: false, callConfirmation: false, creditAccounts: false, invoices: false })

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
  billing = await import("./billing")

  await prisma.tenant.createMany({ data: [merry, other, small] })
  for (const t of [merry, other, small]) {
    const db = tenantDb(t.id)
    await db.category.create({ data: { id: `${t.id}-cat`, tenantId: t.id, nameTa: "முட்டை", nameEn: "Eggs" } })
    await db.deliverySlot.create({
      data: { id: { t1: "slot-am", t2: "slot-am-2", t3: "slot-am-3" }[t.id]!, tenantId: t.id, nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 3 },
    })
  }
  const db = tenantDb(merry.id)
  await db.product.create({
    data: { id: "p-eggs", tenantId: merry.id, categoryId: "t1-cat", nameTa: "முட்டை", nameEn: "Eggs", packTa: "30", packEn: "Tray of 30", pricePaise: 39_000, stockQty: 10 },
  })
  await tenantDb(small.id).product.create({
    data: { id: "p-small", tenantId: small.id, categoryId: "t3-cat", nameTa: "முட்டை", nameEn: "Eggs", packTa: "6", packEn: "6 eggs", pricePaise: 9_000, stockQty: 0 },
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
    await expect(svc.setOrderStatus(merry.id, o!.id, "packed", "staff-1")).rejects.toThrow("bad_transition")
  })
})

describe("delivery, invoices and khata", () => {
  const priya = async () => (await tenantDb(merry.id).customer.findFirst({ where: { phone: "+919000010001" } }))!
  const toDoorstep = async (number: number) => {
    const o = (await tenantDb(merry.id).order.findFirst({ where: { number } }))!
    if (o.status === "to_confirm") await svc.recordCall(merry.id, o.id, "confirmed", "staff-1")
    await svc.setOrderStatus(merry.id, o.id, "packed", "staff-1")
    await svc.setOrderStatus(merry.id, o.id, "out_for_delivery", "staff-1")
    return o
  }

  it("refuses to deliver through the plain status change", async () => {
    const o = (await tenantDb(merry.id).order.findFirst({ where: { number: 1002 } }))!
    await expect(svc.setOrderStatus(merry.id, o.id, "delivered", "staff-1")).rejects.toThrow("use_deliver")
  })

  it("delivers on credit: issues invoice 0001 and leaves the amount as dues", async () => {
    const o = await toDoorstep(1002)
    const { invoice } = await billing.deliverOrder(merry.id, o.id, "credit", "staff-1", NOW)
    expect(invoice).toMatchObject({ number: "MF/2026-27/0001", type: "bill_of_supply", totalPaise: 42_000, seq: 1 })
    expect(invoice!.publicToken.length).toBeGreaterThanOrEqual(20)
    const snap = billing.readSnapshot(invoice!.snapshot)
    expect(snap.lines[0]).toMatchObject({ nameTa: "முட்டை", qty: 1, amountPaise: 39_000 })
    expect(snap.deliveryFeePaise).toBe(3000)
    expect(await billing.customerBalance(merry.id, (await priya()).id)).toBe(42_000)
    const delivered = (await tenantDb(merry.id).order.findFirst({ where: { id: o.id } }))!
    expect(delivered.status).toBe("delivered")
    expect(delivered.deliveredAt).not.toBeNull()
  })

  it("cannot deliver the same order twice", async () => {
    const o = (await tenantDb(merry.id).order.findFirst({ where: { number: 1002 } }))!
    await expect(billing.deliverOrder(merry.id, o.id, "cash", "staff-1", NOW)).rejects.toThrow("bad_transition")
    expect(await tenantDb(merry.id).invoice.count()).toBe(1)
  })

  it("delivers paid in cash: next invoice number, no new dues", async () => {
    const o = await toDoorstep(1003)
    const { invoice } = await billing.deliverOrder(merry.id, o.id, "cash", "staff-1", NOW)
    expect(invoice!.number).toBe("MF/2026-27/0002")
    expect(await billing.customerBalance(merry.id, (await priya()).id)).toBe(42_000)
    const pay = await tenantDb(merry.id).payment.findFirst({ where: { orderId: o.id } })
    expect(pay).toMatchObject({ method: "cash_on_delivery", amountPaise: o.totalPaise })
  })

  it("records a later payment against the khata", async () => {
    const c = await priya()
    await billing.recordPayment(merry.id, { customerId: c.id, method: "upi_on_delivery", amountPaise: 30_000, byStaffId: "staff-1", reference: "UPI123" })
    expect(await billing.customerBalance(merry.id, c.id)).toBe(12_000)
    expect((await billing.allBalances(merry.id)).get(c.id)).toBe(12_000)
    await expect(billing.recordPayment(merry.id, { customerId: c.id, method: "upi_on_delivery", amountPaise: 0, byStaffId: "s" })).rejects.toThrow("bad_amount")
  })

  it("keeps invoices and balances separate per farm", async () => {
    expect(await tenantDb(other.id).invoice.count()).toBe(0)
    expect((await billing.allBalances(other.id)).size).toBe(0)
    const c = await priya()
    await expect(billing.recordPayment(other.id, { customerId: c.id, method: "upi_on_delivery", amountPaise: 100, byStaffId: "s" })).rejects.toThrow("customer_not_found")
  })
})

describe("feature switches change what the server does", () => {
  const smallOrder = () => order({ items: [{ productId: "p-small", qty: 5 }], slotKey: "2026-10-22|slot-am-3" })

  it("skips stock checks and the confirmation call when those are off", async () => {
    const { order: o, decision } = await svc.placeOrder(small, smallOrder(), NOW)
    expect(o.status).toBe("confirmed")
    expect(decision.reason).toBe("calls_off")
    // Stock stays untouched (0) and the order still went through.
    expect((await tenantDb(small.id).product.findFirst({ where: { id: "p-small" } }))!.stockQty).toBe(0)
  })

  it("refuses 'on account' when credit accounts are off, and issues no invoice", async () => {
    const o = (await tenantDb(small.id).order.findFirst({ where: { status: "confirmed" } }))!
    await svc.setOrderStatus(small.id, o.id, "out_for_delivery", "staff-1")
    await expect(billing.deliverOrder(small.id, o.id, "credit", "staff-1", NOW)).rejects.toThrow("credit_off")
    const { invoice } = await billing.deliverOrder(small.id, o.id, "cash", "staff-1", NOW)
    expect(invoice).toBeNull()
    expect(await tenantDb(small.id).invoice.count()).toBe(0)
    expect(await tenantDb(small.id).payment.count()).toBe(1)
  })
})

describe("farm-side orders and edits", () => {
  const db = () => tenantDb(merry.id)
  const eggsStock = async () => (await db().product.findFirst({ where: { id: "p-eggs" } }))!.stockQty
  const staffOrder = (over: Partial<import("./orders").PlaceOrderInput> = {}) =>
    order({ channel: "phone", customer: { phone: "+919000010009", name: "Lakshmi", language: "ta" }, items: [{ productId: "p-eggs", qty: 1 }], byStaffId: "staff-1", ...over })

  it("lets staff book a full slot, which customers can't", async () => {
    const saturday = "2026-10-24|slot-am" // max 3 orders
    for (let i = 0; i < 3; i++) await svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 1 }], slotKey: saturday }), NOW)
    await expect(svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 1 }], slotKey: saturday }), NOW)).rejects.toThrow("slot_full")
    const { order: o } = await svc.placeOrder(merry, staffOrder({ slotKey: saturday, staffOverride: true }), NOW)
    expect(o).toMatchObject({ channel: "phone", status: "confirmed", slotDate: "2026-10-24" })
  })

  it("lets staff book after the online cut-off, but customers can't", async () => {
    const lateEvening = new Date("2026-10-21T14:30:00Z") // 20:00 IST, after tomorrow-morning's 19:00 cut-off
    await expect(svc.placeOrder(merry, order({ slotKey: "2026-10-22|slot-am" }), lateEvening)).rejects.toThrow("slot_closed")
    const { order: o } = await svc.placeOrder(merry, staffOrder({ staffOverride: true }), lateEvening)
    expect(o.slotDate).toBe("2026-10-22")
  })

  it("records a walk-in sale: no slot, no delivery fee, handed over and invoiced at once", async () => {
    const before = await eggsStock()
    const { order: o } = await svc.placeOrder(merry, staffOrder({ channel: "walk_in", slotKey: null, address: null }), NOW)
    expect(o).toMatchObject({ status: "confirmed", slotId: null, deliveryFeePaise: 0, totalPaise: 39_000, addressId: null })
    expect(await eggsStock()).toBe(before - 1)
    const { invoice } = await billing.deliverOrder(merry.id, o.id, "upi", "staff-1", NOW)
    expect(invoice?.type).toBe("bill_of_supply")
    expect((await db().order.findFirst({ where: { id: o.id } }))!.status).toBe("delivered")
  })

  it("needs an address for anything that isn't a walk-in", async () => {
    await expect(svc.placeOrder(merry, staffOrder({ address: null, staffOverride: true }), NOW)).rejects.toThrow("address_required")
  })

  it("edits items: keeps the agreed price, adjusts stock by the difference, recomputes totals", async () => {
    await db().product.updateMany({ where: { id: "p-eggs" }, data: { stockQty: 20 } })
    const { order: o } = await svc.placeOrder(
      merry,
      staffOrder({ channel: "whatsapp", items: [{ productId: "p-eggs", qty: 1 }], slotKey: "2026-10-23|slot-am", staffOverride: true }),
      NOW
    )
    expect(o.status).toBe("to_confirm") // WhatsApp orders wait for a call
    await db().product.updateMany({ where: { id: "p-eggs" }, data: { pricePaise: 45_000 } }) // price rises afterwards
    const stockBefore = await eggsStock()

    const totals = await svc.editOrder(merry, o.id, { items: [{ productId: "p-eggs", qty: 3 }], slotKey: "2026-10-23|slot-am", address: {}, paymentMethod: "cash_on_delivery", note: "3 trays" }, "staff-1", NOW)
    expect(totals).toMatchObject({ subtotalPaise: 117_000, deliveryFeePaise: 0, totalPaise: 117_000 }) // 3 × the agreed ₹390
    expect(await eggsStock()).toBe(stockBefore - 2)
    const after = (await db().order.findFirst({ where: { id: o.id }, include: { items: true, events: true } }))!
    expect(after).toMatchObject({ status: "to_confirm", paymentMethod: "cash_on_delivery", note: "3 trays" })
    expect(after.items).toHaveLength(1)
    expect(after.events.map((e) => e.note)).toContain("edited")

    // Fewer items put stock back.
    await svc.editOrder(merry, o.id, { items: [{ productId: "p-eggs", qty: 1 }], slotKey: "2026-10-23|slot-am", address: {}, paymentMethod: "cash_on_delivery" }, "staff-1", NOW)
    expect(await eggsStock()).toBe(stockBefore)
  })

  it("confirms the order when the edit comes from a call ('Changed')", async () => {
    const o = (await db().order.findFirst({ where: { status: "to_confirm", channel: "whatsapp" } }))!
    await svc.editOrder(merry, o.id, { items: [{ productId: "p-eggs", qty: 2 }], slotKey: "2026-10-23|slot-am", address: {}, paymentMethod: "upi_on_delivery", fromCall: true }, "staff-1", NOW)
    const after = (await db().order.findFirst({ where: { id: o.id }, include: { calls: true } }))!
    expect(after.status).toBe("confirmed")
    expect(after.calls.map((c) => c.outcome)).toEqual(["changed"])
  })

  it("refuses edits once the order is packed", async () => {
    const o = (await db().order.findFirst({ where: { status: "confirmed", channel: "whatsapp" } }))!
    await svc.setOrderStatus(merry.id, o.id, "packed", "staff-1")
    await expect(
      svc.editOrder(merry, o.id, { items: [{ productId: "p-eggs", qty: 1 }], slotKey: "2026-10-23|slot-am", address: {}, paymentMethod: "upi_on_delivery" }, "staff-1", NOW)
    ).rejects.toThrow("not_editable")
  })

  it("never edits another farm's order", async () => {
    const o = (await db().order.findFirst())!
    await expect(
      svc.editOrder(other, o.id, { items: [{ productId: "p-other", qty: 1 }], slotKey: "2026-10-22|slot-am-2", address: {}, paymentMethod: "upi_on_delivery" }, "staff-1", NOW)
    ).rejects.toThrow("not_found")
  })
})
