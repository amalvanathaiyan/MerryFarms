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
  farmLat: null as number | null,
  farmLng: null as number | null,
  deliveryRadiusKm: null as number | null,
  servedPincodes: [] as string[],
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

describe("returns and credit notes", () => {
  let returns: typeof import("./returns")
  beforeAll(async () => {
    returns = await import("./returns")
  })
  const db = () => tenantDb(merry.id)
  const priyaId = async () => (await db().customer.findFirst({ where: { phone: "+919000010001" } }))!.id
  const balance = async () => billing.customerBalance(merry.id, await priyaId())
  const base = { reason: "damaged" as const, restock: false, refundDeliveryFee: false }

  it("refunds a cash-paid item: credit note in its own series, stock back, balance unchanged", async () => {
    const o = (await db().order.findFirst({ where: { number: 1003 } }))! // 1 tray, paid cash on delivery
    const stock = (await db().product.findFirst({ where: { id: "p-eggs" } }))!.stockQty
    const before = await balance()
    const { creditNote, plan } = await returns.processReturn(merry.id, o.id, { ...base, items: [{ productId: "p-eggs", qty: 1 }], refundMethod: "cash", restock: true }, "staff-1", NOW)
    expect(plan.totalPaise).toBe(39_000)
    expect(creditNote).toMatchObject({ number: "MF-CN/2026-27/0001", type: "credit_note", totalPaise: 39_000 })
    const snap = billing.readSnapshot(creditNote!.snapshot)
    expect(snap.against?.number).toMatch(/^MF\/2026-27\/\d{4}$/)
    expect((await db().product.findFirst({ where: { id: "p-eggs" } }))!.stockQty).toBe(stock + 1)
    expect(await balance()).toBe(before) // credit −390, refund +390
    expect(await db().payment.count({ where: { orderId: o.id, status: "refunded" } })).toBe(1)
  })

  it("won't return more than was delivered", async () => {
    const o = (await db().order.findFirst({ where: { number: 1003 } }))!
    await expect(returns.processReturn(merry.id, o.id, { ...base, items: [{ productId: "p-eggs", qty: 1 }], refundMethod: "cash" }, "staff-1", NOW)).rejects.toThrow("too_many_returned")
  })

  it("credits the account for an on-account order and refunds the delivery charge when everything comes back", async () => {
    const o = (await db().order.findFirst({ where: { number: 1002 } }))! // 1 tray + ₹30 delivery, on account
    const before = await balance()
    const { plan, creditNote } = await returns.processReturn(merry.id, o.id, { ...base, reason: "short_delivered", items: [{ productId: "p-eggs", qty: 1 }], refundMethod: "account", refundDeliveryFee: true }, "staff-1", NOW)
    expect(plan).toMatchObject({ goodsPaise: 39_000, deliveryFeePaise: 3000, totalPaise: 42_000, fullyReturned: true })
    expect(creditNote!.number).toBe("MF-CN/2026-27/0002")
    expect(await balance()).toBe(before - 42_000)
    // Invoice numbers are untouched by credit notes.
    expect(await db().invoice.count({ where: { type: { not: "credit_note" } } })).toBe(await db().invoice.count({ where: { number: { startsWith: "MF/" } } }))
  })

  it("only returns delivered orders", async () => {
    const o = (await db().order.findFirst({ where: { status: { not: "delivered" } } }))!
    await expect(returns.processReturn(merry.id, o.id, { ...base, items: [{ productId: "p-eggs", qty: 1 }], refundMethod: "cash" }, "staff-1", NOW)).rejects.toThrow("not_delivered")
  })

  it("on a farm without invoices or credit: no credit note, and no 'on account'", async () => {
    const o = (await tenantDb(small.id).order.findFirst({ where: { status: "delivered" } }))!
    await expect(returns.processReturn(small.id, o.id, { ...base, items: [{ productId: "p-small", qty: 1 }], refundMethod: "account" }, "staff-1", NOW)).rejects.toThrow("credit_off")
    const { creditNote, ret } = await returns.processReturn(small.id, o.id, { ...base, items: [{ productId: "p-small", qty: 1 }], refundMethod: "upi" }, "staff-1", NOW)
    expect(creditNote).toBeNull()
    expect(ret).toMatchObject({ amountPaise: 9_000, refundMethod: "upi", restocked: false })
  })

  it("refuses returns when the farm has switched them off", async () => {
    await prisma.tenant.update({ where: { id: small.id }, data: { features: { ...small.features, returns: false } } })
    const o = (await tenantDb(small.id).order.findFirst({ where: { status: "delivered" } }))!
    await expect(returns.processReturn(small.id, o.id, { ...base, items: [{ productId: "p-small", qty: 1 }], refundMethod: "cash" }, "staff-1", NOW)).rejects.toThrow("returns_off")
  })
})

describe("message templates per farm", () => {
  it("uses each farm's own wording and never another farm's", async () => {
    const { templateOverrides } = await import("./messages")
    await tenantDb(merry.id).messageTemplate.create({ data: { tenantId: merry.id, key: "delivered", bodyTa: "நன்றி {name}! மீண்டும் வாங்குங்கள்." } })
    expect((await templateOverrides(merry.id)).delivered?.ta).toBe("நன்றி {name}! மீண்டும் வாங்குங்கள்.")
    expect((await templateOverrides(other.id)).delivered).toBeUndefined()
  })
})

describe("weekly and daily plans", () => {
  let plans: typeof import("./plans")
  const planFarm = tenantRow("t4", "planfarm", { subscriptions: true })
  const pf = { ...planFarm, plan: "growth" as const }
  const pdb = () => tenantDb(pf.id)
  let customerId = ""
  let addressId = ""
  const THU = "2026-10-22" // NOW is Wed 15:30 IST, so Thursday is tomorrow

  beforeAll(async () => {
    plans = await import("./plans")
    await prisma.tenant.create({ data: pf })
    await pdb().category.create({ data: { id: "t4-cat", tenantId: pf.id, nameTa: "முட்டை", nameEn: "Eggs" } })
    await pdb().deliverySlot.create({ data: { id: "slot-t4", tenantId: pf.id, nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 1 } })
    await pdb().product.create({ data: { id: "p-t4", tenantId: pf.id, categoryId: "t4-cat", nameTa: "முட்டை", nameEn: "Eggs", packTa: "30", packEn: "Tray of 30", pricePaise: 39_000, stockQty: 3 } })
    const c = await pdb().customer.create({ data: { tenantId: pf.id, phone: "+919000040001", name: "Plan customer" } })
    customerId = c.id
    addressId = (await pdb().address.create({ data: { tenantId: pf.id, customerId: c.id, line: "1, Main Road" } })).id
  })

  const input = () => ({ customerId, addressId, slotId: "slot-t4", items: [{ productId: "p-t4", qty: 1 }], daysOfWeek: [4], paymentMethod: "cash_on_delivery" as const, discountPct: 5, startDate: "2026-10-21" })

  it("is refused while plans are switched off or not in the farm's plan", async () => {
    await expect(plans.createPlan(merry, { ...input(), customerId: "x" })).rejects.toThrow("plans_off")
  })

  it("creates tomorrow's order at the plan price, with no call, and never twice", async () => {
    const plan = await plans.createPlan(pf, input())
    const r1 = await plans.generatePlanOrders(pf, NOW)
    expect(r1.created).toEqual([{ planId: plan.id, orderNumber: 1001, date: THU }])
    const o = (await pdb().order.findFirst({ where: { subscriptionId: plan.id } }))!
    expect(o).toMatchObject({ status: "confirmed", needsCall: false, slotDate: THU, subtotalPaise: 37_100 })
    const r2 = await plans.generatePlanOrders(pf, NOW)
    expect(r2.created).toEqual([])
    expect(await pdb().order.count({ where: { subscriptionId: plan.id } })).toBe(1)
  })

  it("skipping a day cancels that day's order and puts stock back; un-skipping brings it back", async () => {
    const plan = (await pdb().subscription.findFirst())!
    await plans.changePlan(pf.id, plan.id, { kind: "skip", date: THU })
    expect(await pdb().order.count({ where: { subscriptionId: plan.id, status: { not: "cancelled" } } })).toBe(0)
    expect((await pdb().product.findFirst({ where: { id: "p-t4" } }))!.stockQty).toBe(3)
    expect((await plans.generatePlanOrders(pf, NOW)).created).toEqual([])
    await plans.changePlan(pf.id, plan.id, { kind: "unskip", date: THU })
    expect((await plans.generatePlanOrders(pf, NOW)).created).toHaveLength(1)
  })

  it("books a plan order even into a full slot (the slot holds 1)", async () => {
    const second = await plans.createPlan(pf, { ...input(), discountPct: 0 })
    const r = await plans.generatePlanOrders(pf, NOW)
    expect(r.created.map((c) => c.planId)).toEqual([second.id])
  })

  it("holds a plan order back when stock runs out, and says why", async () => {
    await pdb().product.updateMany({ where: { id: "p-t4" }, data: { stockQty: 0 } })
    const third = await plans.createPlan(pf, input())
    const r = await plans.generatePlanOrders(pf, NOW)
    expect(r.held).toEqual([{ planId: third.id, customerName: "Plan customer", date: THU, reason: "out_of_stock" }])
  })

  it("makes nothing while paused, and resumes", async () => {
    await pdb().product.updateMany({ where: { id: "p-t4" }, data: { stockQty: 10 } })
    const third = (await pdb().subscription.findFirst({ orderBy: { createdAt: "desc" } }))!
    await plans.changePlan(pf.id, third.id, { kind: "pause", until: "2026-10-31" })
    expect((await plans.generatePlanOrders(pf, NOW)).created).toEqual([])
    await plans.changePlan(pf.id, third.id, { kind: "resume" })
    expect((await plans.generatePlanOrders(pf, NOW)).created.map((c) => c.planId)).toEqual([third.id])
  })

  it("the scheduled job covers every farm with plans on", async () => {
    const all = await plans.generateAllPlanOrders(NOW)
    expect(all.map((a) => a.slug)).toEqual(["planfarm"])
  })
})

describe("reports", () => {
  it("adds up a farm's delivered orders, returns, payments and calls, and nothing from other farms", async () => {
    const { loadReport, duesList } = await import("./reports")
    const { istDate } = await import("@/domain/ist")
    const range = { from: "2026-10-01", to: istDate(new Date()) > "2026-10-21" ? istDate(new Date()) : "2026-10-21" }
    const r = await loadReport(merry.id, range.from, range.to)
    expect(r.summary.orders).toBeGreaterThan(0)
    expect(r.summary.netPaise).toBe(r.summary.grossPaise - r.summary.returnsPaise)
    expect(r.products.length).toBeGreaterThan(0)
    expect(r.calls.ordersCalled).toBeGreaterThan(0)
    const empty = await loadReport(other.id, range.from, range.to)
    expect(empty.summary.orders).toBe(0)
    expect(empty.calls.ordersCalled).toBe(0)
    const dues = await duesList(merry.id)
    expect(dues.every((d) => d.balancePaise > 0)).toBe(true)
  })
})

describe("delivery area", () => {
  // Farm near Tambaram; delivers within 8 km, plus one extra PIN code.
  const af = { ...tenantRow("t5", "areafarm"), farmLat: 12.95, farmLng: 80.14, deliveryRadiusKm: 8, servedPincodes: ["600048"] }
  const adb = () => tenantDb(af.id)
  const web = (address: import("./orders").PlaceOrderInput["address"], phone = "+919000050001") =>
    order({ customer: { phone, name: "Area test", language: "ta" }, address, items: [{ productId: "p-t5", qty: 1 }], slotKey: "2026-10-22|slot-t5" })

  beforeAll(async () => {
    await prisma.tenant.create({ data: af })
    await adb().category.create({ data: { id: "t5-cat", tenantId: af.id, nameTa: "முட்டை", nameEn: "Eggs" } })
    await adb().deliverySlot.create({ data: { id: "slot-t5", tenantId: af.id, nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 50 } })
    await adb().product.create({ data: { id: "p-t5", tenantId: af.id, categoryId: "t5-cat", nameTa: "முட்டை", nameEn: "Eggs", packTa: "30", packEn: "Tray of 30", pricePaise: 39_000, stockQty: 50 } })
  })

  it("accepts a web order whose shared location is inside the radius, and saves the distance", async () => {
    const { order: o } = await svc.placeOrder(af, web({ line: "Near the farm", pincode: "600126", lat: 12.96, lng: 80.15 }), NOW)
    expect(o.areaCheck).toBe("inside")
    expect(o.distanceKm).toBeGreaterThan(1)
    expect(o.distanceKm).toBeLessThan(2)
  })

  it("refuses a web order from outside the area", async () => {
    await expect(svc.placeOrder(af, web({ line: "Chennai Central", pincode: "600003", lat: 13.0827, lng: 80.2757 }), NOW)).rejects.toThrow("out_of_area")
  })

  it("accepts a listed PIN even past the radius", async () => {
    const { order: o } = await svc.placeOrder(af, web({ line: "Across the highway", pincode: "600048", lat: 13.0827, lng: 80.2757 }, "+919000050002"), NOW)
    expect(o.areaCheck).toBe("inside")
  })

  it("lets an order through as 'unknown' when it can't tell, for staff to check on the call", async () => {
    const { order: o } = await svc.placeOrder(af, web({ line: "No location shared", pincode: "600126" }, "+919000050003"), NOW)
    expect(o).toMatchObject({ areaCheck: "unknown", status: "to_confirm" })
  })

  it("only flags staff orders from outside the area", async () => {
    const { order: o } = await svc.placeOrder(af, { ...web({ line: "Chennai Central", pincode: "600003", lat: 13.0827, lng: 80.2757 }, "+919000050004"), channel: "phone", staffOverride: true }, NOW)
    expect(o.areaCheck).toBe("outside")
  })

  it("checks nothing when the farm switches the delivery area off", async () => {
    const off = { ...af, features: { deliveryArea: false } }
    const { order: o } = await svc.placeOrder(off, web({ line: "Chennai Central", pincode: "600003", lat: 13.0827, lng: 80.2757 }, "+919000050005"), NOW)
    expect(o.areaCheck).toBeNull()
  })
})

describe("customer identity without login", () => {
  let customers: typeof import("./customers")
  beforeAll(async () => {
    customers = await import("./customers")
  })

  it("connects a new number with a private key", async () => {
    const r = await customers.connectCustomer(merry, { name: "QR visitor", phone: "+919000060001", language: "ta" })
    expect(r.status).toBe("connected")
    if (r.status !== "connected") return
    expect(r.token.length).toBeGreaterThanOrEqual(30)
    expect((await customers.customerByToken(merry.id, r.token))?.name).toBe("QR visitor")
  })

  it("never connects someone to an existing customer just by typing their number", async () => {
    expect(await customers.connectCustomer(merry, { name: "Not Priya", phone: "+919000010001", language: "ta" })).toEqual({ status: "known" })
  })

  it("a key only works for its own farm", async () => {
    const c = (await tenantDb(merry.id).customer.findFirst({ where: { phone: "+919000060001" } }))!
    expect(await customers.customerByToken(other.id, c.accessToken!)).toBeNull()
    expect(await customers.customerByToken(merry.id, "short")).toBeNull()
  })

  it("resetting a key cuts off the old link", async () => {
    const c = (await tenantDb(merry.id).customer.findFirst({ where: { phone: "+919000060001" } }))!
    const old = c.accessToken!
    const fresh = await customers.issueToken(merry.id, c.id)
    expect(fresh).not.toBe(old)
    expect(await customers.customerByToken(merry.id, old)).toBeNull()
    expect((await customers.customerByToken(merry.id, fresh))?.id).toBe(c.id)
    expect(await customers.ensureToken(merry.id, c.id)).toBe(fresh)
  })

  it("reuses a returning customer's saved address instead of duplicating it", async () => {
    const phone = "+919000060002"
    const addr = { line: "5, Temple Street", pincode: "600126" }
    await svc.placeOrder(merry, { ...staffOrderFor(phone), address: addr }, NOW)
    await svc.placeOrder(merry, { ...staffOrderFor(phone), address: { ...addr, line: "5, temple street " } }, NOW)
    const c = (await tenantDb(merry.id).customer.findFirst({ where: { phone }, include: { addresses: true } }))!
    expect(c.addresses).toHaveLength(1)
  })

  const staffOrderFor = (phone: string): import("./orders").PlaceOrderInput => ({
    channel: "phone",
    customer: { phone, name: "Returning", language: "ta" },
    address: null,
    items: [{ productId: "p-eggs", qty: 1 }],
    slotKey: "2026-10-23|slot-am",
    paymentMethod: "cash_on_delivery",
    staffOverride: true,
  })
})

describe("messages in the app", () => {
  let chat: typeof import("./chat")
  let priyaId = ""
  beforeAll(async () => {
    chat = await import("./chat")
    priyaId = (await tenantDb(merry.id).customer.findFirst({ where: { phone: "+919000010001" } }))!.id
  })

  it("delivers a customer message to the farm's inbox as unread and waiting", async () => {
    await chat.sendFromCustomer(merry.id, priyaId, "  நாளை 2 தட்டு வேண்டும்  ")
    expect(await chat.unreadForFarm(merry.id)).toBe(1)
    const [row] = await chat.inbox(merry.id)
    expect(row).toMatchObject({ customerId: priyaId, unread: 1, last: { body: "நாளை 2 தட்டு வேண்டும்", sender: "customer" } })
    expect(row.waitingSince).not.toBeNull()
  })

  it("marks messages seen when the farm opens the conversation, and the reply clears 'waiting'", async () => {
    await chat.markSeen(merry.id, priyaId, "farm")
    expect(await chat.unreadForFarm(merry.id)).toBe(0)
    await chat.sendFromFarm(merry.id, priyaId, "சரி, 2 தட்டு அனுப்புகிறோம்.", "staff-1")
    expect(await chat.unreadForCustomer(merry.id, priyaId)).toBe(1)
    const [row] = await chat.inbox(merry.id)
    expect(row.waitingSince).toBeNull()
    expect(row.last.seenAt).toBeNull() // not seen by the customer yet
    await chat.markSeen(merry.id, priyaId, "customer")
    const [after] = await chat.inbox(merry.id)
    expect(after.last.seenAt).not.toBeNull() // ✓✓ Seen
    expect((await chat.thread(merry.id, priyaId)).map((m) => m.sender)).toEqual(["customer", "farm"])
  })

  it("refuses empty or overlong messages, and floods", async () => {
    await expect(chat.sendFromCustomer(merry.id, priyaId, "   ")).rejects.toThrow("message_empty")
    await expect(chat.sendFromCustomer(merry.id, priyaId, "x".repeat(1001))).rejects.toThrow("message_too_long")
    for (let i = 0; i < chat.CUSTOMER_HOURLY_LIMIT - 1; i++) await chat.sendFromCustomer(merry.id, priyaId, `hi ${i}`)
    await expect(chat.sendFromCustomer(merry.id, priyaId, "one too many")).rejects.toThrow("message_rate_limited")
  })

  it("keeps conversations inside their farm", async () => {
    expect(await chat.inbox(other.id)).toEqual([])
    await expect(chat.sendFromFarm(other.id, priyaId, "hello", "staff-x")).rejects.toThrow("customer_not_found")
    expect(await chat.thread(other.id, priyaId)).toEqual([])
  })
})

describe("phone notifications", () => {
  let notify: typeof import("./notify")
  const sent: { endpoint: string; note: { title: string; url: string; tag?: string } }[] = []
  const keys = { p256dh: "k", auth: "a" }
  let priya = ""
  beforeAll(async () => {
    notify = await import("./notify")
    notify.setPushSenderForTests(async (s, payload) => {
      if (s.endpoint.endsWith("/gone")) throw Object.assign(new Error("gone"), { statusCode: 410 })
      sent.push({ endpoint: s.endpoint, note: JSON.parse(payload) })
    })
    const db = tenantDb(merry.id)
    priya = (await db.customer.findFirst({ where: { phone: "+919000010001" } }))!.id
    await db.staffMember.createMany({
      data: [
        { id: "st-owner", tenantId: merry.id, authUserId: "u1", name: "Owner", roles: ["owner"] },
        { id: "st-driver", tenantId: merry.id, authUserId: "u2", name: "Driver", roles: ["delivery"] },
        { id: "st-left", tenantId: merry.id, authUserId: "u3", name: "Left", roles: ["order_desk"], isActive: false },
      ],
    })
    await notify.saveSubscription(merry.id, { staffId: "st-owner" }, { endpoint: "https://push.test/owner", ...keys })
    await notify.saveSubscription(merry.id, { staffId: "st-driver" }, { endpoint: "https://push.test/driver", ...keys })
    await notify.saveSubscription(merry.id, { staffId: "st-left" }, { endpoint: "https://push.test/left", ...keys })
    await notify.saveSubscription(merry.id, { customerId: priya }, { endpoint: "https://push.test/priya", ...keys })
    await notify.saveSubscription(merry.id, { customerId: priya }, { endpoint: "https://push.test/gone", ...keys })
    await notify.saveSubscription(other.id, { staffId: "st-x" }, { endpoint: "https://push.test/other-farm", ...keys })
  })

  it("new orders and messages reach active owner and order-desk phones only", async () => {
    sent.length = 0
    await notify.notifyStaff(merry.id, { title: "New order", body: "", url: "/farm/orders" })
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.test/owner"])
  })

  it("order updates reach the customer in their language, and dropped phones are forgotten", async () => {
    sent.length = 0
    const o = await tenantDb(merry.id).order.findFirst({ where: { customerId: priya, status: "delivered" } })
    await notify.notifyOrderStatus(merry.id, o!.id)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ endpoint: "https://push.test/priya", note: { url: "/my", tag: `order-MF-${o!.number}` } })
    expect(sent[0].note.title).toContain("டெலிவரி")
    expect(await tenantDb(merry.id).pushSubscription.count({ where: { customerId: priya } })).toBe(1)
  })

  it("a phone moves to whoever connected on it last (shared family phone)", async () => {
    const c = await tenantDb(merry.id).customer.create({ data: { tenantId: merry.id, phone: "+919000050001", name: "Ravi" } })
    await notify.saveSubscription(merry.id, { customerId: c.id }, { endpoint: "https://push.test/priya", ...keys })
    sent.length = 0
    await notify.notifyCustomer(merry.id, priya, { title: "x", body: "", url: "/my" })
    expect(sent).toEqual([])
  })

  it("stays quiet when the farm switches notifications off", async () => {
    await prisma.tenant.update({ where: { id: merry.id }, data: { features: { pushNotifications: false } } })
    sent.length = 0
    await notify.notifyStaff(merry.id, { title: "x", body: "", url: "/farm" })
    expect(sent).toEqual([])
    await prisma.tenant.update({ where: { id: merry.id }, data: { features: {} } })
  })
})

describe("sign-in codes", () => {
  let otp: typeof import("./otp")
  const phone = "+919000060001"
  const t0 = new Date("2026-10-22T10:00:00Z")
  const at = (s: number) => new Date(t0.getTime() + s * 1000)
  beforeAll(async () => {
    otp = await import("./otp")
  })

  it("sends a code, accepts it once, and limits resends", async () => {
    const r = await otp.requestCode(merry as never, phone, "ta", t0)
    expect(r.ok && r.demoCode).toMatch(/^\d{6}$/)
    const code = (r as { demoCode: string }).demoCode
    expect(await otp.requestCode(merry as never, phone, "ta", at(10))).toEqual({ ok: false, error: "otp_wait", seconds: 20 })
    expect(await otp.verifyCode(merry.id, phone, code, at(20))).toBe("ok")
    expect(await otp.verifyCode(merry.id, phone, code, at(21))).toBe("no_code")
  })

  it("locks a code after 5 wrong tries, and a code never works on another farm", async () => {
    const r = await otp.requestCode(merry as never, phone, "ta", at(100))
    const code = (r as { demoCode: string }).demoCode
    const wrong = code === "000000" ? "111111" : "000000"
    expect(await otp.verifyCode(other.id, phone, code, at(101))).toBe("no_code")
    for (let i = 0; i < 5; i++) expect(await otp.verifyCode(merry.id, phone, wrong, at(102))).toBe("wrong")
    expect(await otp.verifyCode(merry.id, phone, code, at(103))).toBe("too_many_tries")
  })

  it("expires codes after 5 minutes", async () => {
    const r = await otp.requestCode(merry as never, "+919000060002", "en", t0)
    expect(await otp.verifyCode(merry.id, "+919000060002", (r as { demoCode: string }).demoCode, at(301))).toBe("expired")
  })

  it("stores only a hash, and the 'verified number' note is signed per farm and expires", async () => {
    const rows = await tenantDb(merry.id).otpCode.findMany({ where: { phone } })
    expect(rows.every((x) => /^[0-9a-f]{64}$/.test(x.codeHash))).toBe(true)
    const note = otp.signVerified(merry.id, phone, t0)
    expect(otp.readVerified(merry.id, note, at(60))).toBe(phone)
    expect(otp.readVerified(other.id, note, at(60))).toBeNull()
    expect(otp.readVerified(merry.id, note, at(21 * 60))).toBeNull()
    expect(otp.readVerified(merry.id, note.replace(/.$/, (c) => (c === "A" ? "B" : "A")), at(60))).toBeNull()
  })

  it("registers a verified new number once, with its address", async () => {
    const customers = await import("./customers")
    const a = await customers.registerVerified(merry as never, { phone: "+919000060003", name: "Kavya", language: "ta", address: { line: "4, Temple Street", pincode: "600048" } })
    const b = await customers.registerVerified(merry as never, { phone: "+919000060003", name: "Kavya again", language: "ta" })
    expect(b.customerId).toBe(a.customerId)
    expect(b.token).toBe(a.token)
    const addresses = await tenantDb(merry.id).address.findMany({ where: { customerId: a.customerId } })
    expect(addresses.map((x) => x.line)).toEqual(["4, Temple Street"])
  })
})

describe("WhatsApp alert to the farm for new orders", () => {
  let notify: typeof import("./notify")
  let cloud: typeof import("./whatsapp-cloud")
  const sent: { to: string; name: string; lang: string; body: string[] }[] = []
  const order = { code: "MF-2001", customerName: "Priya", totalPaise: 19_800, items: "1 × முட்டை (12)", needsCall: true }
  const farm = () => prisma.tenant.findUniqueOrThrow({ where: { id: merry.id } })
  beforeAll(async () => {
    notify = await import("./notify")
    cloud = await import("./whatsapp-cloud")
    cloud.setWhatsAppSenderForTests(async (to, t) => {
      sent.push({ to, ...t })
    })
  })

  it("does nothing until the platform's WhatsApp account is set up", async () => {
    sent.length = 0
    await notify.alertFarmOnWhatsApp((await farm()) as never, order)
    expect(sent).toEqual([])
  })

  it("sends the order to the farm's WhatsApp number in Tamil, unless switched off", async () => {
    process.env.WHATSAPP_API_TOKEN = "t"
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1"
    try {
      sent.length = 0
      await notify.alertFarmOnWhatsApp((await farm()) as never, order)
      expect(sent).toEqual([{ to: "+919000020001", name: "new_order_alert", lang: "ta", body: ["MF-2001", "Priya", "₹198 · அழைக்க வேண்டும்", "1 × முட்டை (12)"] }])

      await prisma.tenant.update({ where: { id: merry.id }, data: { features: { whatsappAlerts: false } } })
      sent.length = 0
      await notify.alertFarmOnWhatsApp((await farm()) as never, order)
      expect(sent).toEqual([])
    } finally {
      await prisma.tenant.update({ where: { id: merry.id }, data: { features: {} } })
      delete process.env.WHATSAPP_API_TOKEN
      delete process.env.WHATSAPP_PHONE_NUMBER_ID
    }
  })
})

describe("offer prices and staff discounts", () => {
  const db = () => tenantDb(merry.id)
  const walkIn = (over: Partial<import("./orders").PlaceOrderInput> = {}) =>
    order({ channel: "walk_in", slotKey: null, address: null, customer: { phone: "+919000070001", name: "Offer test", language: "ta" }, items: [{ productId: "p-eggs", qty: 1 }], byStaffId: "staff-1", staffOverride: true, ...over })
  beforeAll(async () => {
    await db().product.updateMany({ where: { id: "p-eggs" }, data: { stockQty: 100, pricePaise: 39_000, offerPricePaise: 36_000, offerEndsOn: "2026-10-21" } })
  })
  afterAll(async () => {
    await db().product.updateMany({ where: { id: "p-eggs" }, data: { offerPricePaise: null, offerEndsOn: null } })
  })

  it("charges the offer price up to its last day, then the usual price", async () => {
    const onLastDay = await svc.placeOrder(merry, walkIn(), NOW) // 21 Oct IST
    expect(onLastDay.order.totalPaise).toBe(36_000)
    const dayAfter = await svc.placeOrder(merry, walkIn(), new Date("2026-10-22T06:00:00Z"))
    expect(dayAfter.order.totalPaise).toBe(39_000)
  })

  it("lets staff agree a lower price, never above the usual price", async () => {
    const { order: o } = await svc.placeOrder(merry, walkIn({ prices: { "p-eggs": 35_000 } }), NOW)
    expect(o.totalPaise).toBe(35_000)
    await expect(svc.placeOrder(merry, walkIn({ prices: { "p-eggs": 40_000 } }), NOW)).rejects.toThrow("price_invalid")
  })

  it("ignores prices sent with a customer's own web order", async () => {
    const { order: o } = await svc.placeOrder(merry, order({ items: [{ productId: "p-eggs", qty: 1 }], slotKey: "2026-10-26|slot-am", prices: { "p-eggs": 100 } }), NOW)
    expect(o.subtotalPaise).toBe(36_000)
  })

  it("keeps an agreed price when editing, and can change it", async () => {
    const { order: o } = await svc.placeOrder(merry, order({ channel: "phone", items: [{ productId: "p-eggs", qty: 2 }], slotKey: "2026-10-23|slot-am", byStaffId: "staff-1", staffOverride: true, prices: { "p-eggs": 35_000 } }), NOW)
    const base = { items: [{ productId: "p-eggs", qty: 2 }], slotKey: "2026-10-23|slot-am", address: { id: o.addressId! }, paymentMethod: "upi_on_delivery" as const }
    await svc.editOrder(merry, o.id, base, "staff-1", NOW)
    expect((await db().orderItem.findFirst({ where: { orderId: o.id } }))!.unitPricePaise).toBe(35_000)
    await svc.editOrder(merry, o.id, { ...base, prices: { "p-eggs": 34_000 } }, "staff-1", NOW)
    expect((await db().orderItem.findFirst({ where: { orderId: o.id } }))!.unitPricePaise).toBe(34_000)
  })
})

describe("closed days", () => {
  const db = () => tenantDb(merry.id)
  afterAll(async () => {
    await db().closedDay.deleteMany({})
  })

  it("removes a closed day from the slots customers and staff can book", async () => {
    const before = await svc.openSlotOptions(merry.id, NOW)
    expect(before.some((o) => o.date === "2026-10-27")).toBe(true)
    await db().closedDay.create({ data: { tenantId: merry.id, date: "2026-10-27", slotId: null, note: "Deepavali" } })
    expect((await svc.openSlotOptions(merry.id, NOW)).some((o) => o.date === "2026-10-27")).toBe(false)
    expect((await svc.openSlotOptions(merry.id, NOW, { forStaff: true })).some((o) => o.date === "2026-10-27")).toBe(false)
    await expect(svc.placeOrder(merry, order({ slotKey: "2026-10-27|slot-am" }), NOW)).rejects.toThrow("slot_closed")
    await expect(
      svc.placeOrder(merry, order({ channel: "phone", slotKey: "2026-10-27|slot-am", byStaffId: "staff-1", staffOverride: true }), NOW)
    ).rejects.toThrow("slot_closed")
  })

  it("can close just one delivery time on a day, and is per farm", async () => {
    await db().closedDay.create({ data: { tenantId: merry.id, date: "2026-10-26", slotId: "slot-am", note: null } })
    expect((await svc.openSlotOptions(merry.id, NOW, { forStaff: true })).some((o) => o.key === "2026-10-26|slot-am")).toBe(false)
    expect((await svc.openSlotOptions(other.id, NOW, { forStaff: true })).some((o) => o.date === "2026-10-26")).toBe(true)
  })
})
