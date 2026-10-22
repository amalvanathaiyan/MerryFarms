import { istInstant } from "./ist"
/** Order lifecycle. Every WhatsApp order starts at to_confirm until a call (or a rule) confirms it. */

export type OrderStatus = "to_confirm" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled"
export type OrderChannel = "whatsapp" | "web" | "phone" | "walk_in"
export type PaymentMethod = "upi_on_delivery" | "cash_on_delivery" | "upi_prepaid" | "credit"
export type CallOutcome = "confirmed" | "changed" | "cancelled" | "no_answer" | "wrong_number"

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  to_confirm: ["confirmed", "cancelled"],
  // confirmed/packed → delivered covers pickup at the farm and walk-in sales.
  confirmed: ["packed", "out_for_delivery", "delivered", "cancelled"],
  packed: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT[from].includes(to)
}

/** The single forward step the farm app offers as its main button. */
export function nextStep(status: OrderStatus): OrderStatus | null {
  const forward: Partial<Record<OrderStatus, OrderStatus>> = {
    to_confirm: "confirmed",
    confirmed: "packed",
    packed: "out_for_delivery",
    out_for_delivery: "delivered",
  }
  return forward[status] ?? null
}

export const isOpen = (s: OrderStatus) => s !== "delivered" && s !== "cancelled"

/** Items, slot and address can change until the order is packed. */
export const isEditable = (s: OrderStatus) => s === "to_confirm" || s === "confirmed"

/**
 * Stock change per product when an order's items change from `before` to `after`.
 * Positive = take more from stock; negative = put back.
 */
export function stockDeltas(before: { productId: string; qty: number }[], after: { productId: string; qty: number }[]): Map<string, number> {
  const d = new Map<string, number>()
  for (const i of after) d.set(i.productId, (d.get(i.productId) ?? 0) + i.qty)
  for (const i of before) d.set(i.productId, (d.get(i.productId) ?? 0) - i.qty)
  for (const [k, v] of d) if (v === 0) d.delete(k)
  return d
}

/** "MF-1047" from a farm prefix and running number. */
export function orderCode(prefix: string, number: number): string {
  return `${prefix}-${number}`
}

// ── Confirmation-call rules ───────────────────────────────────────────────────

export interface CallRules {
  callWhatsAppOrders: boolean
  callWebOrdersFromNew: boolean
  newCustomerOrderCount: number
  callAboveTotalPaise: number
  callAboveUsualMultiple: number
  skipCallForTrusted: boolean
  skipCallForPrepaid: boolean
}

export interface CallContext {
  channel: OrderChannel
  paymentMethod: PaymentMethod
  totalPaise: number
  isPlanOrder?: boolean
  customer: {
    isTrusted: boolean
    deliveredOrders: number
    usualOrderPaise: number | null // median of recent orders, null if none
  }
}

export type CallDecision = { needsCall: true; reason: string } | { needsCall: false; reason: string }

/**
 * Decides whether staff must call before an order counts as confirmed.
 * Large or unusual orders always need a call, even from trusted customers,
 * because those are the accidental orders that cost the farm most.
 */
export function decideCall(rules: CallRules, ctx: CallContext): CallDecision {
  if (ctx.channel === "phone" || ctx.channel === "walk_in") return { needsCall: false, reason: "taken_in_person" }
  if (ctx.isPlanOrder) return { needsCall: false, reason: "plan_order" }

  if (rules.callAboveTotalPaise > 0 && ctx.totalPaise > rules.callAboveTotalPaise) {
    return { needsCall: true, reason: "large_order" }
  }
  const usual = ctx.customer.usualOrderPaise
  if (usual && rules.callAboveUsualMultiple > 0 && ctx.totalPaise > usual * rules.callAboveUsualMultiple) {
    return { needsCall: true, reason: "unusual_order" }
  }

  if (rules.skipCallForPrepaid && ctx.paymentMethod === "upi_prepaid") return { needsCall: false, reason: "prepaid" }
  if (rules.skipCallForTrusted && ctx.customer.isTrusted) return { needsCall: false, reason: "trusted_customer" }

  const isNew = ctx.customer.deliveredOrders < rules.newCustomerOrderCount
  if (ctx.channel === "whatsapp" && rules.callWhatsAppOrders) return { needsCall: true, reason: "whatsapp_order" }
  if (ctx.channel === "web" && rules.callWebOrdersFromNew && isNew) return { needsCall: true, reason: "new_customer" }
  return { needsCall: false, reason: "rules_allow" }
}

/** What happens to an order after a call attempt. */
export function afterCall(
  outcome: CallOutcome,
  attempt: number,
  maxAttempts: number
): { status: OrderStatus | null; retry: boolean; needsOwner: boolean } {
  switch (outcome) {
    case "confirmed":
    case "changed":
      return { status: "confirmed", retry: false, needsOwner: false }
    case "cancelled":
      return { status: "cancelled", retry: false, needsOwner: false }
    case "wrong_number":
      return { status: null, retry: false, needsOwner: true }
    case "no_answer":
      return attempt >= maxAttempts
        ? { status: null, retry: false, needsOwner: true }
        : { status: null, retry: true, needsOwner: false }
  }
}

/**
 * A customer may cancel or change their own order while the farm hasn't started on it
 * (waiting for the call, or confirmed) and the slot's ordering cut-off hasn't passed.
 * After that, packing may have begun: they call the farm instead.
 */
export function customerMayChange(
  order: { status: OrderStatus; channel: OrderChannel; slotDate: string },
  slot: { startTime: string; cutoffHours: number } | null,
  now: Date
): boolean {
  if (order.status !== "to_confirm" && order.status !== "confirmed") return false
  if (order.channel === "walk_in" || !slot) return false
  const cutoff = istInstant(order.slotDate, slot.startTime).getTime() - slot.cutoffHours * 3_600_000
  return now.getTime() < cutoff
}

export const CUSTOMER_CANCEL_REASONS = ["mistake", "not_needed", "other"] as const
export type CustomerCancelReason = (typeof CUSTOMER_CANCEL_REASONS)[number]
