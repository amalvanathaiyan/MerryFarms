import "server-only"
import type { PaymentMethod, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { featuresOf } from "@/lib/features"
import { tenantDb } from "@/lib/tenant-db"
import type { Tenant } from "@/lib/tenant"
import { addDays, istDate, istInstant } from "@/domain/ist"
import { planDayCheck, validatePlan } from "@/domain/plans"
import { slotKey } from "@/domain/slots"
import { OrderError, placeOrder, setOrderStatus } from "./orders"

export type PlanItems = { productId: string; qty: number }[]
export const planItems = (json: Prisma.JsonValue) => json as unknown as PlanItems

export interface PlanInput {
  customerId: string
  addressId: string | null
  slotId: string
  items: PlanItems
  daysOfWeek: number[]
  paymentMethod: PaymentMethod
  discountPct: number
  startDate: string
  note?: string
}

async function checkPlanInput(tenant: Tenant, input: PlanInput) {
  const features = featuresOf(tenant)
  if (!features.subscriptions) throw new OrderError("plans_off")
  if (input.paymentMethod === "credit" && !features.creditAccounts) throw new OrderError("credit_off")
  const problem = validatePlan(input)
  if (problem) throw new OrderError(problem)
  const db = tenantDb(tenant.id)
  const [customer, slot, products] = await Promise.all([
    db.customer.findFirst({ where: { id: input.customerId }, include: { addresses: true } }),
    db.deliverySlot.findFirst({ where: { id: input.slotId } }),
    db.product.findMany({ where: { id: { in: input.items.map((i) => i.productId) }, deletedAt: null } }),
  ])
  if (!customer) throw new OrderError("customer_not_found")
  if (!slot) throw new OrderError("slot_not_found")
  if (input.addressId && !customer.addresses.some((a) => a.id === input.addressId)) throw new OrderError("address_not_found")
  if (!input.addressId && customer.addresses.length === 0) throw new OrderError("address_required")
  if (products.length !== new Set(input.items.map((i) => i.productId)).size) throw new OrderError("product_unavailable")
  return { customer }
}

export async function createPlan(tenant: Tenant, input: PlanInput) {
  const { customer } = await checkPlanInput(tenant, input)
  return tenantDb(tenant.id).subscription.create({
    data: {
      tenantId: tenant.id,
      ...input,
      addressId: input.addressId ?? customer.addresses[0]?.id ?? null,
      items: input.items.filter((i) => i.qty > 0),
      daysOfWeek: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
      note: input.note || null,
    },
  })
}

export async function updatePlan(tenant: Tenant, planId: string, input: PlanInput) {
  await checkPlanInput(tenant, input)
  const r = await tenantDb(tenant.id).subscription.updateMany({
    where: { id: planId, status: { not: "cancelled" } },
    data: {
      ...input,
      items: input.items.filter((i) => i.qty > 0),
      daysOfWeek: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
      note: input.note || null,
    },
  })
  if (r.count !== 1) throw new OrderError("plan_not_found")
}

export type PlanChange = { kind: "pause"; until: string | null } | { kind: "resume" } | { kind: "skip"; date: string } | { kind: "unskip"; date: string } | { kind: "cancel" }

/** Pause (until a date, or until resumed), resume, skip or un-skip one day, or cancel. */
export async function changePlan(tenantId: string, planId: string, change: PlanChange) {
  const db = tenantDb(tenantId)
  const plan = await db.subscription.findFirst({ where: { id: planId } })
  if (!plan || plan.status === "cancelled") throw new OrderError("plan_not_found")
  const data: Prisma.SubscriptionUpdateManyMutationInput =
    change.kind === "pause"
      ? { status: "paused", pausedUntil: change.until }
      : change.kind === "resume"
        ? { status: "active", pausedUntil: null }
        : change.kind === "skip"
          ? { skipDates: [...new Set([...plan.skipDates, change.date])].sort() }
          : change.kind === "unskip"
            ? { skipDates: plan.skipDates.filter((d) => d !== change.date) }
            : { status: "cancelled" }
  await db.subscription.updateMany({ where: { id: planId }, data })
  // Skipping, pausing or cancelling also cancels a plan order already created for those days,
  // as long as it isn't packed yet.
  if (change.kind !== "resume" && change.kind !== "unskip") {
    const after = (await db.subscription.findFirst({ where: { id: planId } }))!
    const slot = await db.deliverySlot.findFirst({ where: { id: after.slotId } })
    const pending = await db.order.findMany({ where: { subscriptionId: planId, status: { in: ["to_confirm", "confirmed"] } } })
    for (const o of pending) {
      if (slot && planDayCheck(after, slot, o.slotDate) !== null) {
        await setOrderStatus(tenantId, o.id, "cancelled", "plan", `plan:${change.kind}`)
        // Unlink it, so un-skipping or resuming can create that day's order again.
        await db.order.updateMany({ where: { id: o.id }, data: { subscriptionId: null } })
      }
    }
  }
}

export interface PlanRunResult {
  created: { planId: string; orderNumber: number; date: string }[]
  held: { planId: string; customerName: string; date: string; reason: string }[]
}

/**
 * Creates plan orders for today and tomorrow, where the slot hasn't started yet.
 * Safe to run any number of times: a plan never gets two orders for the same day.
 * Runs when staff open Today, and from the scheduled job (/api/cron/plans).
 */
export async function generatePlanOrders(tenant: Tenant, now = new Date()): Promise<PlanRunResult> {
  const result: PlanRunResult = { created: [], held: [] }
  if (!featuresOf(tenant).subscriptions || tenant.status === "suspended") return result

  const db = tenantDb(tenant.id)
  const plans = await db.subscription.findMany({
    where: { status: { in: ["active", "paused"] } },
    include: { customer: true, slot: true },
  })
  if (plans.length === 0) return result

  const today = istDate(now)
  for (const date of [today, addDays(today, 1)]) {
    const existing = new Set(
      (await db.order.findMany({ where: { slotDate: date, subscriptionId: { in: plans.map((p) => p.id) } }, select: { subscriptionId: true } })).map((o) => o.subscriptionId)
    )
    for (const plan of plans) {
      if (existing.has(plan.id)) continue
      if (planDayCheck(plan, plan.slot, date) !== null) continue
      if (istInstant(date, plan.slot.startTime).getTime() <= now.getTime()) continue // slot already started
      try {
        const { order } = await placeOrder(
          tenant,
          {
            channel: "phone",
            customer: { phone: plan.customer.phone, name: plan.customer.name, language: plan.customer.language },
            address: plan.addressId ? { id: plan.addressId } : null,
            items: planItems(plan.items),
            slotKey: slotKey(date, plan.slotId),
            paymentMethod: plan.paymentMethod,
            note: plan.note ?? undefined,
            staffOverride: true, // a plan is already agreed: book past the online cut-off or into a full slot
            subscriptionId: plan.id,
            discountPct: plan.discountPct,
          },
          now
        )
        result.created.push({ planId: plan.id, orderNumber: order.number, date })
      } catch (e) {
        if (!(e instanceof OrderError)) throw e
        result.held.push({ planId: plan.id, customerName: plan.customer.name, date, reason: e.code })
      }
    }
  }
  return result
}

/** For the scheduled job: every farm with plans switched on. */
export async function generateAllPlanOrders(now = new Date()) {
  const tenants = await prisma.tenant.findMany({ where: { status: { not: "suspended" } } })
  const out: { slug: string; created: number; held: number }[] = []
  for (const t of tenants) {
    if (!featuresOf(t).subscriptions) continue
    const r = await generatePlanOrders(t, now)
    out.push({ slug: t.slug, created: r.created.length, held: r.held.length })
  }
  return out
}
