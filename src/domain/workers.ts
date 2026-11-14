/**
 * Farm Core's workers (docs/platform-plan.md §3.2), the pure part: what a day of work is worth, what a worker has
 * earned and is still owed, and labour by place. Tested; src/server/workers.ts loads and saves.
 *
 * Workers have no login. A day is present, half a day or absent. Pay is by the day, or by the month (a month's pay
 * is 30 days' worth, so a missed day costs one thirtieth). Every rupee given to a worker, wage or advance, is labour
 * spending in Money; an advance is simply paid before the work, so what is owed is earned minus everything given.
 */

export const DAY_STATES = ["present", "half", "absent"] as const
export type DayState = (typeof DAY_STATES)[number]
export const PAY_TYPES = ["daily", "monthly"] as const
export type PayType = (typeof PAY_TYPES)[number]
export const PAYMENT_KINDS = ["wage", "advance"] as const
export type PaymentKind = (typeof PAYMENT_KINDS)[number]

/** Days a month's pay covers. */
export const MONTH_DAYS = 30

/** How much of a day was worked. */
export const dayShare = (state: string) => (state === "present" ? 1 : state === "half" ? 0.5 : 0)

/** One full day's pay, in paise. */
export const dayRatePaise = (w: { payType: string; ratePaise: number }) => (w.payType === "monthly" ? w.ratePaise / MONTH_DAYS : w.ratePaise)

/** Days worked (halves count half) and what they earned, in whole paise. */
export function earned(w: { payType: string; ratePaise: number }, days: { state: string }[]) {
  const worked = days.reduce((a, d) => a + dayShare(d.state), 0)
  return { days: worked, paise: Math.round(worked * dayRatePaise(w)) }
}

/** Still owed to the worker (negative: the worker has had more than earned, an advance not yet worked off). */
export const owed = (earnedPaise: number, paid: { amountPaise: number }[]) => earnedPaise - paid.reduce((a, p) => a + p.amountPaise, 0)

/**
 * Labour by place: each day's pay goes to where the worker worked that day (null = the whole farm). For profit by
 * place and Money's reports; the payments themselves stay whole-farm labour.
 */
export function labourByPlace(workers: { id: string; payType: string; ratePaise: number }[], days: { workerId: string; state: string; placeId: string | null }[]) {
  const out = new Map<string | null, number>()
  for (const d of days) {
    const w = workers.find((x) => x.id === d.workerId)
    if (!w) continue
    const v = dayShare(d.state) * dayRatePaise(w)
    if (v) out.set(d.placeId, (out.get(d.placeId) ?? 0) + v)
  }
  return new Map([...out].map(([k, v]) => [k, Math.round(v)]))
}

export const isPayKind = (v: unknown): v is PaymentKind => typeof v === "string" && (PAYMENT_KINDS as readonly string[]).includes(v)
