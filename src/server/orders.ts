import "server-only"
import { Prisma, type OrderStatus } from "@prisma/client"
import { tenantDb, type TenantTx } from "@/lib/tenant-db"
import type { Tenant } from "@/lib/tenant"
import { afterCall, canTransition, decideCall, type CallOutcome, type CallRules } from "@/domain/orders"
import { orderTotals } from "@/domain/pricing"
import { slotKey, slotRangeLabel, upcomingSlots } from "@/domain/slots"
import { addDays, istDate } from "@/domain/ist"
import { featuresOf } from "@/lib/features"

export class OrderError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

const DEFAULT_RULES: CallRules = {
  callWhatsAppOrders: true,
  callWebOrdersFromNew: true,
  newCustomerOrderCount: 3,
  callAboveTotalPaise: 150_000,
  callAboveUsualMultiple: 3,
  skipCallForTrusted: true,
  skipCallForPrepaid: true,
}

/** Booked order counts per `${date}|${slotId}` for the next `days` days. */
export async function bookedCounts(tenantId: string, now = new Date(), days = 10) {
  const db = tenantDb(tenantId)
  const from = istDate(now)
  const rows = await db.order.groupBy({
    by: ["slotDate", "slotId"],
    where: { status: { not: "cancelled" }, slotDate: { gte: from, lte: addDays(from, days) }, slotId: { not: null } },
    _count: { _all: true },
  })
  const counts: Record<string, number> = {}
  for (const r of rows) counts[slotKey(r.slotDate, r.slotId!)] = r._count._all
  return counts
}

export async function openSlotOptions(tenantId: string, now = new Date()) {
  const db = tenantDb(tenantId)
  const slots = await db.deliverySlot.findMany({ where: { isActive: true } })
  const options = upcomingSlots(slots, await bookedCounts(tenantId, now), now)
  return options.map((o) => ({ ...o, slot: slots.find((s) => s.id === o.slotId)! }))
}

export interface PlaceOrderInput {
  channel: "web" | "whatsapp" | "phone" | "walk_in"
  customer: { phone: string; name: string; language: "ta" | "en" }
  address: { line: string; landmark?: string }
  items: { productId: string; qty: number }[]
  slotKey: string
  paymentMethod: "upi_on_delivery" | "cash_on_delivery" | "upi_prepaid" | "credit"
  note?: string
  byStaffId?: string
}

/**
 * Creates an order for a farm in one transaction:
 * checks products, stock and the delivery slot, prices it, decides whether a
 * confirmation call is needed, takes the next order number and reduces stock.
 */
export async function placeOrder(tenant: Tenant, input: PlaceOrderInput, now = new Date()) {
  if (input.items.length === 0) throw new OrderError("empty_cart")
  const db = tenantDb(tenant.id)

  // Merge duplicate lines so stock checks see the real quantity.
  const qtyById = new Map<string, number>()
  for (const i of input.items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty)

  const [slotDate, slotId] = input.slotKey.split("|")
  const option = (await openSlotOptions(tenant.id, now)).find((o) => o.key === input.slotKey)
  if (!option || !slotDate || !slotId) throw new OrderError("slot_closed")
  if (option.full) throw new OrderError("slot_full")

  const settings = await db.tenantSettings.findFirst()
  const rules: CallRules = settings ?? DEFAULT_RULES
  const features = featuresOf(tenant)

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: [...qtyById.keys()] }, isActive: true, deletedAt: null },
        })
        if (products.length !== qtyById.size) throw new OrderError("product_unavailable")
        if (features.stockTracking) {
          for (const p of products) {
            if (p.stockQty < qtyById.get(p.id)!) throw new OrderError("out_of_stock")
          }
        }

        const lines = products.map((p) => ({
          productId: p.id,
          qty: qtyById.get(p.id)!,
          unitPricePaise: p.pricePaise,
          gstRate: p.gstRate,
        }))
        const totals = orderTotals(lines, tenant)

        const customer = await tx.customer.upsert({
          where: { tenantId_phone: { tenantId: tenant.id, phone: input.customer.phone } },
          update: { name: input.customer.name },
          create: { tenantId: tenant.id, phone: input.customer.phone, name: input.customer.name, language: input.customer.language },
        })
        const address = await tx.address.create({
          data: { tenantId: tenant.id, customerId: customer.id, line: input.address.line, landmark: input.address.landmark || null },
        })

        const history = await tx.order.findMany({
          where: { customerId: customer.id, status: "delivered" },
          select: { totalPaise: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
        const sorted = history.map((h) => h.totalPaise).sort((a, b) => a - b)
        const decision = !features.callConfirmation
          ? ({ needsCall: false, reason: "calls_off" } as const)
          : decideCall(rules, {
          channel: input.channel,
          paymentMethod: input.paymentMethod,
          totalPaise: totals.totalPaise,
          customer: {
            isTrusted: customer.isTrusted,
            deliveredOrders: history.length,
            usualOrderPaise: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
          },
        })

        const last = await tx.order.aggregate({ _max: { number: true } })
        const number = (last._max.number ?? 1000) + 1
        const status: OrderStatus = decision.needsCall ? "to_confirm" : "confirmed"

        const order = await tx.order.create({
          data: {
            tenantId: tenant.id,
            number,
            customerId: customer.id,
            addressId: address.id,
            channel: input.channel,
            status,
            slotId,
            slotDate,
            slotLabel: slotRangeLabel(option.slot.startTime, option.slot.endTime),
            paymentMethod: input.paymentMethod,
            subtotalPaise: totals.subtotalPaise,
            deliveryFeePaise: totals.deliveryFeePaise,
            totalPaise: totals.totalPaise,
            needsCall: decision.needsCall,
            note: input.note || null,
            items: { create: lines.map((l) => ({ ...l, tenantId: tenant.id })) },
            events: {
              create: { tenantId: tenant.id, toStatus: status, byStaffId: input.byStaffId ?? null, note: decision.reason },
            },
          },
          include: { items: true },
        })

        for (const l of features.stockTracking ? lines : []) {
          // Conditional decrement: fails (count 0) if another order took the stock meanwhile.
          const r = await tx.product.updateMany({
            where: { id: l.productId, stockQty: { gte: l.qty } },
            data: { stockQty: { decrement: l.qty } },
          })
          if (r.count !== 1) throw new OrderError("out_of_stock")
        }
        return { order, customer, decision }
      })
    } catch (e) {
      // Two orders took the same number at once: try again with the next one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
      throw e
    }
  }
  throw new OrderError("busy_try_again")
}

/**
 * One status change inside an open transaction: checks the move is allowed, restores
 * stock on cancel, and logs the event. Used by every path that changes an order's status.
 */
export async function transition(
  tx: TenantTx,
  tenantId: string,
  orderId: string,
  to: OrderStatus,
  byStaffId: string,
  note?: string
) {
  const order = await tx.order.findFirst({ where: { id: orderId }, include: { items: true } })
  if (!order) throw new OrderError("not_found")
  if (!canTransition(order.status, to)) throw new OrderError("bad_transition")

  // Conditional on the old status, so a double tap or two staff at once can't apply it twice.
  const r = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: {
      status: to,
      cancelReason: to === "cancelled" ? note ?? null : order.cancelReason,
      deliveredAt: to === "delivered" ? new Date() : order.deliveredAt,
    },
  })
  if (r.count !== 1) throw new OrderError("bad_transition")

  if (to === "cancelled") {
    for (const i of order.items) {
      await tx.product.updateMany({ where: { id: i.productId }, data: { stockQty: { increment: i.qty } } })
    }
  }
  await tx.orderEvent.create({
    data: { tenantId, orderId: order.id, fromStatus: order.status, toStatus: to, byStaffId, note: note ?? null },
  })
  return { ...order, status: to }
}

/** Moves an order along its lifecycle. Delivery goes through billing.deliverOrder instead. */
export async function setOrderStatus(tenantId: string, orderId: string, to: OrderStatus, byStaffId: string, note?: string) {
  if (to === "delivered") throw new OrderError("use_deliver")
  return tenantDb(tenantId).$transaction((tx) => transition(tx, tenantId, orderId, to, byStaffId, note))
}

/** Records a confirmation call and applies its outcome, together. */
export async function recordCall(
  tenantId: string,
  orderId: string,
  outcome: CallOutcome,
  byStaffId: string,
  note?: string
) {
  const db = tenantDb(tenantId)
  const settings = await db.tenantSettings.findFirst()
  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId } })
    if (!order) throw new OrderError("not_found")
    if (order.status !== "to_confirm") throw new OrderError("not_waiting_for_call")

    const attempt = (await tx.confirmationCall.count({ where: { orderId } })) + 1
    await tx.confirmationCall.create({
      data: { tenantId, orderId, attempt, outcome, calledById: byStaffId, note: note ?? null },
    })
    const result = afterCall(outcome, attempt, settings?.maxCallAttempts ?? 3)
    if (result.status) await transition(tx, tenantId, orderId, result.status, byStaffId, `call:${outcome}`)
    return { attempt, ...result }
  })
}
