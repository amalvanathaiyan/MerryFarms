import "server-only"
import { Prisma, type OrderStatus } from "@prisma/client"
import { tenantDb, type TenantTx } from "@/lib/tenant-db"
import type { Tenant } from "@/lib/tenant"
import { afterCall, canTransition, customerMayChange, decideCall, orderCode, isEditable, stockDeltas, type CallOutcome, type CallRules } from "@/domain/orders"
import { orderTotals } from "@/domain/pricing"
import { slotKey, slotRangeLabel, upcomingSlots } from "@/domain/slots"
import { addDays, istDate } from "@/domain/ist"
import { planUnitPrice } from "@/domain/plans"
import { areaConfigured, checkArea, type DeliveryArea, type LocationSource, type PinCheck } from "@/domain/delivery-area"

/** The farm's delivery area as the rules need it. */
export function areaOf(t: { farmLat: number | null; farmLng: number | null; deliveryRadiusKm: number | null; servedPincodes: string[] }): DeliveryArea {
  return {
    farm: t.farmLat != null && t.farmLng != null ? { lat: t.farmLat, lng: t.farmLng } : null,
    radiusKm: t.deliveryRadiusKm,
    pincodes: t.servedPincodes,
  }
}
import { featuresOf } from "@/lib/features"
import { currentPrice, validAgreedPrice } from "@/domain/offers"

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

/**
 * Delivery slots that can be picked now. Customers see slots until their cut-off;
 * staff (`forStaff`) can book any slot that hasn't started yet, full ones included.
 */
export async function openSlotOptions(tenantId: string, now = new Date(), opts: { forStaff?: boolean } = {}) {
  const db = tenantDb(tenantId)
  const slots = await db.deliverySlot.findMany({ where: { isActive: true } })
  const closed = await db.closedDay.findMany({ where: { date: { gte: istDate(now), lte: addDays(istDate(now), 14) } }, select: { date: true, slotId: true } })
  const options = upcomingSlots(slots, await bookedCounts(tenantId, now), now, opts.forStaff ? { ignoreCutoff: true, daysAhead: 7, wantOpen: 100, closed } : { closed })
  return options.map((o) => ({ ...o, slot: slots.find((s) => s.id === o.slotId)! }))
}

export interface PlaceOrderInput {
  channel: "web" | "whatsapp" | "phone" | "walk_in"
  customer: { phone: string; name: string; language: "ta" | "en" }
  /** An existing address of this customer (`id`), a new one (`line`), or none for walk-ins. */
  address: {
    id?: string
    line?: string
    landmark?: string
    pincode?: string
    lat?: number
    lng?: number
    locationSource?: LocationSource
    placeName?: string
    receiverName?: string
    receiverPhone?: string
  } | null
  /** PIN typed vs PIN at the location (web checkout). A mismatch always gets a confirmation call. */
  pinCheck?: PinCheck
  items: { productId: string; qty: number }[]
  /** `${date}|${slotId}`; null only for walk-in sales at the farm. */
  slotKey: string | null
  paymentMethod: "upi_on_delivery" | "cash_on_delivery" | "upi_prepaid" | "credit"
  note?: string
  byStaffId?: string
  /** Staff booking: allowed after the online cut-off and into a full slot. */
  staffOverride?: boolean
  /** Set when a weekly/daily plan creates the order: no call needed, plan price applies. */
  subscriptionId?: string
  discountPct?: number
  /** Staff only: a price agreed with the customer for a product (a discount, ≤ list price). */
  prices?: Record<string, number>
  /** The customer's earlier order this one replaces (checked by the caller with changeableOrder).
   *  It is cancelled in the same transaction, so its stock counts for the new order. */
  replaces?: string
}

/** Merges duplicate lines so stock checks see the real quantity. */
function mergeItems(items: { productId: string; qty: number }[]) {
  const qtyById = new Map<string, number>()
  for (const i of items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty)
  return qtyById
}

/** Validates a slot choice and returns what the order stores about it. */
/** `freeingKey`: the slot of an order being replaced, whose place this order takes. */
async function resolveSlot(tenantId: string, key: string, now: Date, staffOverride: boolean, freeingKey?: string) {
  const [slotDate, slotId] = key.split("|")
  const option = (await openSlotOptions(tenantId, now, { forStaff: staffOverride })).find((o) => o.key === key)
  if (!option || !slotDate || !slotId) throw new OrderError("slot_closed")
  const fullWithoutOld = option.full && !(freeingKey === key && option.booked - 1 < option.slot.maxOrders)
  if (fullWithoutOld && !staffOverride) throw new OrderError("slot_full")
  return { slotId, slotDate, slotLabel: slotRangeLabel(option.slot.startTime, option.slot.endTime) }
}

/**
 * Creates an order for a farm in one transaction:
 * checks products, stock and the delivery slot, prices it, decides whether a
 * confirmation call is needed, takes the next order number and reduces stock.
 */
export async function placeOrder(tenant: Tenant, input: PlaceOrderInput, now = new Date()) {
  if (input.items.length === 0) throw new OrderError("empty_cart")
  const db = tenantDb(tenant.id)
  const qtyById = mergeItems(input.items)

  const isWalkIn = input.channel === "walk_in"
  const slot = isWalkIn
    ? { slotId: null, slotDate: istDate(now), slotLabel: "" }
    : input.slotKey
      ? await resolveSlot(tenant.id, input.slotKey, now, !!input.staffOverride, await replacedSlotKey(tenant.id, input.replaces))
      : (() => {
          throw new OrderError("slot_closed")
        })()
  if (!isWalkIn && !input.address?.id && !input.address?.line) throw new OrderError("address_required")

  const settings = await db.tenantSettings.findFirst()
  const rules: CallRules = settings ?? DEFAULT_RULES
  const features = featuresOf(tenant)
  if (input.paymentMethod === "credit" && !features.creditAccounts) throw new OrderError("credit_off")

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        if (input.replaces) await transition(tx, tenant.id, input.replaces, "cancelled", null, "customer:changed")
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
          unitPricePaise: agreedOr(p, input.staffOverride ? input.prices : undefined, () => planUnitPrice(currentPrice(p, istDate(now)), input.discountPct ?? 0)),
          gstRate: p.gstRate,
        }))
        // Walk-ins carry their goods home: no delivery charge.
        const totals = orderTotals(lines, isWalkIn ? { deliveryFeePaise: 0, freeAbovePaise: 0 } : tenant)

        const customer = await tx.customer.upsert({
          where: { tenantId_phone: { tenantId: tenant.id, phone: input.customer.phone } },
          update: { name: input.customer.name },
          create: { tenantId: tenant.id, phone: input.customer.phone, name: input.customer.name, language: input.customer.language },
        })

        let address: { id: string; lat: number | null; lng: number | null; pincode: string | null } | null = null
        if (input.address?.id) {
          address = await tx.address.findFirst({ where: { id: input.address.id, customerId: customer.id } })
          if (!address) throw new OrderError("address_not_found")
        } else if (input.address?.line) {
          // The same address typed again (returning customers) reuses the saved one.
          const same = await tx.address.findFirst({
            where: { customerId: customer.id, line: { equals: input.address.line.trim(), mode: "insensitive" }, pincode: input.address.pincode || null },
          })
          // A new location replaces the old one together with how it was given and the place found there.
          const located = input.address.lat != null && input.address.lng != null
          address = same
            ? await tx.address.update({
                where: { id: same.id },
                data: {
                  landmark: input.address.landmark || same.landmark,
                  lat: input.address.lat ?? same.lat,
                  lng: input.address.lng ?? same.lng,
                  ...(located && { locationSource: input.address.locationSource ?? null, placeName: input.address.placeName ?? null }),
                  receiverName: input.address.receiverName ?? null,
                  receiverPhone: input.address.receiverPhone ?? null,
                },
              })
            : await tx.address.create({
                data: {
                  tenantId: tenant.id,
                  customerId: customer.id,
                  line: input.address.line.trim(),
                  landmark: input.address.landmark || null,
                  pincode: input.address.pincode || null,
                  lat: input.address.lat ?? null,
                  lng: input.address.lng ?? null,
                  locationSource: located ? (input.address.locationSource ?? null) : null,
                  placeName: located ? (input.address.placeName ?? null) : null,
                  receiverName: input.address.receiverName ?? null,
                  receiverPhone: input.address.receiverPhone ?? null,
                },
              })
        }
        const addressId = address?.id ?? null

        // Delivery area: customers outside it can't order online; staff orders are only flagged.
        const area = isWalkIn || !features.deliveryArea ? null : areaOf(tenant)
        const check = area && areaConfigured(area) ? checkArea(area, { location: address?.lat != null && address.lng != null ? { lat: address.lat, lng: address.lng } : null, pincode: address?.pincode }) : null
        if (check?.result === "outside" && input.channel === "web") throw new OrderError("out_of_area")

        const history = await tx.order.findMany({
          where: { customerId: customer.id, status: "delivered" },
          select: { totalPaise: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
        const sorted = history.map((h) => h.totalPaise).sort((a, b) => a - b)
        const rulesDecision = !features.callConfirmation
          ? ({ needsCall: false, reason: "calls_off" } as const)
          : decideCall(rules, {
              channel: input.channel,
              paymentMethod: input.paymentMethod,
              totalPaise: totals.totalPaise,
              isPlanOrder: !!input.subscriptionId,
              customer: {
                isTrusted: customer.isTrusted,
                deliveredOrders: history.length,
                usualOrderPaise: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
              },
            })
        // The address says one PIN and the spot on the map is in another district: someone checks it by phone.
        const decision =
          features.callConfirmation && input.pinCheck === "mismatch" && !rulesDecision.needsCall ? ({ needsCall: true, reason: "location_mismatch" } as const) : rulesDecision

        const last = await tx.order.aggregate({ _max: { number: true } })
        const number = (last._max.number ?? 1000) + 1
        const status: OrderStatus = decision.needsCall ? "to_confirm" : "confirmed"

        const order = await tx.order.create({
          data: {
            tenantId: tenant.id,
            number,
            customerId: customer.id,
            addressId,
            channel: input.channel,
            status,
            ...slot,
            paymentMethod: input.paymentMethod,
            subtotalPaise: totals.subtotalPaise,
            deliveryFeePaise: totals.deliveryFeePaise,
            totalPaise: totals.totalPaise,
            needsCall: decision.needsCall,
            note: input.note || null,
            subscriptionId: input.subscriptionId ?? null,
            areaCheck: check?.result ?? null,
            distanceKm: check?.distanceKm ?? null,
            pinCheck: input.pinCheck ?? null,
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
        if (input.replaces) {
          await tx.order.updateMany({ where: { id: input.replaces }, data: { cancelReason: `customer:changed:${orderCode(tenant.invoicePrefix, number)}` } })
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

export interface EditOrderInput {
  items: { productId: string; qty: number }[]
  slotKey: string
  address: { id?: string; line?: string; landmark?: string; pincode?: string; lat?: number; lng?: number }
  paymentMethod: "upi_on_delivery" | "cash_on_delivery" | "upi_prepaid" | "credit"
  note?: string
  /** Set when the edit is the result of a confirmation call ("Changed"): confirms the order too. */
  fromCall?: boolean
  /** A price agreed with the customer for a product (a discount, ≤ list price). */
  prices?: Record<string, number>
}

/**
 * Changes an order that isn't packed yet: items, slot, address, payment, note.
 * Products already on the order keep the price agreed when it was placed;
 * newly added products take today's price. Stock moves by the difference only.
 */
export async function editOrder(tenant: Tenant, orderId: string, input: EditOrderInput, byStaffId: string, now = new Date()) {
  if (input.items.length === 0) throw new OrderError("empty_cart")
  const db = tenantDb(tenant.id)
  const features = featuresOf(tenant)
  if (input.paymentMethod === "credit" && !features.creditAccounts) throw new OrderError("credit_off")
  const qtyById = mergeItems(input.items)
  const settings = await db.tenantSettings.findFirst()

  const current = await db.order.findFirst({ where: { id: orderId }, include: { items: true } })
  if (!current) throw new OrderError("not_found")
  if (current.channel === "walk_in") throw new OrderError("not_editable")
  const sameSlot = current.slotId && input.slotKey === slotKey(current.slotDate, current.slotId)
  // Keeping the slot it already has is always fine; moving it is checked like a staff booking.
  const slot = sameSlot
    ? { slotId: current.slotId, slotDate: current.slotDate, slotLabel: current.slotLabel }
    : await resolveSlot(tenant.id, input.slotKey, now, true)

  return db.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new OrderError("not_found")
    if (!isEditable(order.status)) throw new OrderError("not_editable")

    const products = await tx.product.findMany({ where: { id: { in: [...qtyById.keys()] }, deletedAt: null } })
    if (products.length !== qtyById.size) throw new OrderError("product_unavailable")
    const agreed = new Map(order.items.map((i) => [i.productId, i]))
    for (const p of products) {
      // A product hidden from the shop can stay on an order it was already on, but not be added.
      if (!p.isActive && !agreed.has(p.id)) throw new OrderError("product_unavailable")
    }

    const lines = products.map((p) => ({
      productId: p.id,
      qty: qtyById.get(p.id)!,
      unitPricePaise: agreedOr(p, input.prices, () => agreed.get(p.id)?.unitPricePaise ?? currentPrice(p, istDate(now))),
      gstRate: agreed.get(p.id)?.gstRate ?? p.gstRate,
    }))

    if (features.stockTracking) {
      for (const [productId, delta] of stockDeltas(order.items, lines)) {
        if (delta > 0) {
          const r = await tx.product.updateMany({ where: { id: productId, stockQty: { gte: delta } }, data: { stockQty: { decrement: delta } } })
          if (r.count !== 1) throw new OrderError("out_of_stock")
        } else {
          await tx.product.updateMany({ where: { id: productId }, data: { stockQty: { increment: -delta } } })
        }
      }
    }

    let addressId = order.addressId
    if (input.address.id) {
      const existing = await tx.address.findFirst({ where: { id: input.address.id, customerId: order.customerId } })
      if (!existing) throw new OrderError("address_not_found")
      addressId = existing.id
    } else if (input.address.line) {
      addressId = (
        await tx.address.create({
          data: {
            tenantId: tenant.id,
            customerId: order.customerId,
            line: input.address.line,
            landmark: input.address.landmark || null,
            pincode: input.address.pincode || null,
            lat: input.address.lat ?? null,
            lng: input.address.lng ?? null,
          },
        })
      ).id
    }
    const addr = addressId ? await tx.address.findFirst({ where: { id: addressId } }) : null
    const area = features.deliveryArea ? areaOf(tenant) : null
    const check = area && areaConfigured(area) ? checkArea(area, { location: addr?.lat != null && addr.lng != null ? { lat: addr.lat, lng: addr.lng } : null, pincode: addr?.pincode }) : null

    const totals = orderTotals(lines, tenant)
    await tx.orderItem.deleteMany({ where: { orderId } })
    await tx.orderItem.createMany({ data: lines.map((l) => ({ ...l, orderId, tenantId: tenant.id })) })
    const r = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        ...slot,
        addressId,
        paymentMethod: input.paymentMethod,
        note: input.note || null,
        areaCheck: check?.result ?? null,
        distanceKm: check?.distanceKm ?? null,
        subtotalPaise: totals.subtotalPaise,
        deliveryFeePaise: totals.deliveryFeePaise,
        totalPaise: totals.totalPaise,
      },
    })
    if (r.count !== 1) throw new OrderError("not_editable")
    await tx.orderEvent.create({
      data: { tenantId: tenant.id, orderId, fromStatus: order.status, toStatus: order.status, byStaffId, note: "edited" },
    })

    if (input.fromCall && order.status === "to_confirm") {
      await callInTx(tx, tenant.id, orderId, "changed", byStaffId, undefined, settings?.maxCallAttempts ?? 3)
    }
    return { ...totals }
  })
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
  /** null when the customer did it (cancelling their own order). */
  byStaffId: string | null,
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

/** Logs one call attempt and applies its outcome, inside an open transaction. */
async function callInTx(
  tx: TenantTx,
  tenantId: string,
  orderId: string,
  outcome: CallOutcome,
  byStaffId: string,
  note: string | undefined,
  maxAttempts: number
) {
  const order = await tx.order.findFirst({ where: { id: orderId } })
  if (!order) throw new OrderError("not_found")
  if (order.status !== "to_confirm") throw new OrderError("not_waiting_for_call")

  const attempt = (await tx.confirmationCall.count({ where: { orderId } })) + 1
  await tx.confirmationCall.create({
    data: { tenantId, orderId, attempt, outcome, calledById: byStaffId, note: note ?? null },
  })
  const result = afterCall(outcome, attempt, maxAttempts)
  if (result.status) await transition(tx, tenantId, orderId, result.status, byStaffId, `call:${outcome}`)
  return { attempt, ...result }
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
  return db.$transaction((tx) => callInTx(tx, tenantId, orderId, outcome, byStaffId, note, settings?.maxCallAttempts ?? 3))
}

/** The staff-agreed price for this product if one was given (checked), else the default. */
function agreedOr(p: { id: string; pricePaise: number }, prices: Record<string, number> | undefined, fallback: () => number) {
  const agreed = prices?.[p.id]
  if (agreed === undefined) return fallback()
  if (!validAgreedPrice(agreed, p.pricePaise)) throw new OrderError("price_invalid")
  return agreed
}

// ── Customers changing their own orders ─────────────────────────────────────────

/** The customer's own order, if they may still cancel or change it now. */
export async function changeableOrder(tenantId: string, customerId: string, orderId: string, now = new Date()) {
  const db = tenantDb(tenantId)
  const order = await db.order.findFirst({ where: { id: orderId, customerId }, include: { slot: true, items: true } })
  if (!order) throw new OrderError("not_found")
  if (!customerMayChange(order, order.slot, now)) throw new OrderError("too_late_to_change")
  return order
}

/** The customer cancels their own order (stock goes back, the reason is logged). */
export async function cancelByCustomer(tenantId: string, customerId: string, orderId: string, reason: string, now = new Date()) {
  const order = await changeableOrder(tenantId, customerId, orderId, now)
  return tenantDb(tenantId).$transaction((tx) => transition(tx, tenantId, order.id, "cancelled", null, `customer:${reason}`))
}

async function replacedSlotKey(tenantId: string, orderId: string | undefined) {
  if (!orderId) return undefined
  const o = await tenantDb(tenantId).order.findFirst({ where: { id: orderId }, select: { slotDate: true, slotId: true } })
  return o?.slotId ? slotKey(o.slotDate, o.slotId) : undefined
}
