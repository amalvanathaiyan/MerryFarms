/**
 * Farm records: daily flock figures and expenses, and what they add up to over a period
 * (production, losses, feed, costs and profit). Pure; money in paise, dates IST.
 */

export const EXPENSE_KINDS = ["feed", "medicine", "chicks", "labour", "transport", "electricity", "packing", "other"] as const
export type ExpenseKind = (typeof EXPENSE_KINDS)[number]

export interface DayRecord {
  date: string
  eggsCollected: number | null
  eggsBroken: number | null
  birds: number | null
  birdsLost: number | null
  feedKg: number | null
}

export interface ExpenseRow {
  date: string
  kind: string
  amountPaise: number
}

export interface Production {
  daysRecorded: number
  eggsCollected: number
  eggsBroken: number
  /** Good eggs per recorded day. */
  eggsPerDay: number
  /** Eggs per bird per day, as a percentage (laying rate); null without bird counts. */
  layingRatePct: number | null
  birdsLost: number
  /** Latest bird count in the period. */
  birdsNow: number | null
  feedKg: number
  feedKgPerDay: number
}

export function production(records: DayRecord[]): Production {
  const days = [...records].sort((a, b) => a.date.localeCompare(b.date))
  const sum = (f: (r: DayRecord) => number | null) => days.reduce((a, r) => a + (f(r) ?? 0), 0)
  const collected = sum((r) => r.eggsCollected)
  const broken = sum((r) => r.eggsBroken)
  const withEggs = days.filter((r) => r.eggsCollected != null)
  // Laying rate only over days with both eggs and a bird count.
  const both = days.filter((r) => r.eggsCollected != null && r.birds != null && r.birds > 0)
  const birdDays = both.reduce((a, r) => a + r.birds!, 0)
  const feedDays = days.filter((r) => r.feedKg != null)
  const feed = sum((r) => r.feedKg)
  return {
    daysRecorded: days.length,
    eggsCollected: collected,
    eggsBroken: broken,
    eggsPerDay: withEggs.length ? Math.round((collected - broken) / withEggs.length) : 0,
    layingRatePct: birdDays > 0 ? Math.round((both.reduce((a, r) => a + r.eggsCollected!, 0) / birdDays) * 1000) / 10 : null,
    birdsLost: sum((r) => r.birdsLost),
    birdsNow: [...days].reverse().find((r) => r.birds != null)?.birds ?? null,
    feedKg: Math.round(feed * 10) / 10,
    feedKgPerDay: feedDays.length ? Math.round((feed / feedDays.length) * 10) / 10 : 0,
  }
}

export interface Costs {
  totalPaise: number
  byKind: { kind: string; paise: number }[]
  /** Feed spending per good egg collected; null if no eggs or no feed spending. */
  feedPerEggPaise: number | null
  /** All spending per good egg collected. */
  costPerEggPaise: number | null
}

export function costs(expenses: ExpenseRow[], prod: Pick<Production, "eggsCollected" | "eggsBroken">): Costs {
  const by = new Map<string, number>()
  for (const e of expenses) by.set(e.kind, (by.get(e.kind) ?? 0) + e.amountPaise)
  const total = [...by.values()].reduce((a, b) => a + b, 0)
  const good = prod.eggsCollected - prod.eggsBroken
  const feed = by.get("feed") ?? 0
  return {
    totalPaise: total,
    byKind: [...by.entries()].map(([kind, paise]) => ({ kind, paise })).sort((a, b) => b.paise - a.paise),
    feedPerEggPaise: good > 0 && feed > 0 ? Math.round(feed / good) : null,
    costPerEggPaise: good > 0 && total > 0 ? Math.round(total / good) : null,
  }
}

/** Profit for the period: net sales (after returns) minus everything spent. */
export function profit(netSalesPaise: number, expensesPaise: number) {
  const p = netSalesPaise - expensesPaise
  return { profitPaise: p, marginPct: netSalesPaise > 0 ? Math.round((p / netSalesPaise) * 100) : null }
}

/** Basic sense checks on a day's entry. */
export function checkDayRecord(r: Omit<DayRecord, "date">): string | null {
  for (const v of [r.eggsCollected, r.eggsBroken, r.birds, r.birdsLost]) if (v != null && (!Number.isInteger(v) || v < 0)) return "record_invalid"
  if (r.feedKg != null && (r.feedKg < 0 || r.feedKg > 100_000)) return "record_invalid"
  if (r.eggsBroken != null && r.eggsCollected != null && r.eggsBroken > r.eggsCollected) return "broken_more_than_collected"
  return null
}
