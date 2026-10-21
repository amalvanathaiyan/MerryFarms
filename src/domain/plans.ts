/**
 * Weekly and daily plans (repeat orders).
 * A plan runs on a date when it's active, has started, isn't paused or skipped that day,
 * the date is one of its days, and its delivery slot runs that day.
 */
import { weekday } from "./ist"

export interface PlanRule {
  status: "active" | "paused" | "cancelled"
  startDate: string
  pausedUntil: string | null
  skipDates: string[]
  daysOfWeek: number[]
}

export type PlanSkip = "not_active" | "not_started" | "paused" | "skipped" | "not_a_plan_day" | "slot_not_running"

/** Whether a plan delivers on an IST date, or why not. */
export function planDayCheck(plan: PlanRule, slot: { daysOfWeek: number[]; isActive: boolean }, date: string): PlanSkip | null {
  if (plan.status === "cancelled") return "not_active"
  if (date < plan.startDate) return "not_started"
  // "paused" status with no end date, or paused up to and including this date.
  if (plan.status === "paused" && (!plan.pausedUntil || date <= plan.pausedUntil)) return "paused"
  if (plan.pausedUntil && date <= plan.pausedUntil) return "paused"
  if (plan.skipDates.includes(date)) return "skipped"
  const dow = weekday(date)
  if (!plan.daysOfWeek.includes(dow)) return "not_a_plan_day"
  if (!slot.isActive || !slot.daysOfWeek.includes(dow)) return "slot_not_running"
  return null
}

/** Plan price for one unit: the product price less the plan discount, to the rupee. */
export function planUnitPrice(pricePaise: number, discountPct: number): number {
  if (discountPct <= 0) return pricePaise
  return Math.round((pricePaise * (100 - Math.min(discountPct, 90))) / 100 / 100) * 100
}

/** Next dates (from `from`, inclusive) a plan will deliver, for showing "next delivery". */
export function nextPlanDates(plan: PlanRule, slot: { daysOfWeek: number[]; isActive: boolean }, from: string, count = 3, horizonDays = 35): string[] {
  const out: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  for (let i = 0; i < horizonDays && out.length < count; i++) {
    const date = d.toISOString().slice(0, 10)
    if (planDayCheck(plan, slot, date) === null) out.push(date)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

export function validatePlan(p: { daysOfWeek: number[]; items: { qty: number }[]; discountPct: number }): string | null {
  if (p.items.length === 0 || p.items.every((i) => i.qty <= 0)) return "plan_no_items"
  if (p.daysOfWeek.length === 0 || p.daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "plan_no_days"
  if (!Number.isInteger(p.discountPct) || p.discountPct < 0 || p.discountPct > 50) return "plan_bad_discount"
  return null
}
