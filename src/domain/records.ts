/**
 * Farm records for any kind of farm: what was made or collected each day per product,
 * flock figures for poultry, expenses, and what they add up to (production, costs, profit).
 * Pure; money in paise, dates IST.
 */
import { addDays, addMonths, daysBetween } from "./ist"

/** "chicks" covers any animals bought (chicks, calves, goats); "infrastructure" is building and equipment (a shed, cages, a borewell). */
export const EXPENSE_KINDS = ["raw_materials", "feed", "seeds", "medicine", "chicks", "labour", "transport", "electricity", "packing", "rent", "repairs", "infrastructure", "other"] as const
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

// ── Big costs spread over time ────────────────────────────────────────────────

/** How long a big cost can be spread: whole months, up to 10 years. */
export const SPREAD_CHOICES = [6, 12, 24, 36, 60] as const
export const MAX_SPREAD_MONTHS = 120

/** The last day a spread cost covers: from the day it was paid, for that many months. */
export const spreadEnd = (date: string, months: number) => addDays(addMonths(date, months), -1)

/**
 * The part of an expense that belongs to the period from–to. A one-off cost belongs wholly to the day it was paid;
 * a spread cost is shared out by day over its months, so a ₹1,20,000 shed spread over a year counts about
 * ₹10,000 a month in profit. The money paid out is still the full amount on the day it was paid.
 */
export function costInPeriod(e: { date: string; amountPaise: number; spreadMonths: number | null }, from: string, to: string): number {
  if (!e.spreadMonths || e.spreadMonths < 2) return e.date >= from && e.date <= to ? e.amountPaise : 0
  const end = spreadEnd(e.date, e.spreadMonths)
  const start = e.date > from ? e.date : from
  const stop = end < to ? end : to
  if (stop < start) return 0
  const total = daysBetween(e.date, end) + 1
  // Count in whole paise, and make the shares of the whole spread add up to exactly the amount paid.
  const before = Math.round((e.amountPaise * daysBetween(e.date, start)) / total)
  const upTo = Math.round((e.amountPaise * (daysBetween(e.date, stop) + 1)) / total)
  return upTo - before
}

/** Expenses as they count in a period's profit: one-off costs in it, plus each spread cost's share of it. */
export function costsInPeriod<E extends { date: string; kind: string; amountPaise: number; spreadMonths: number | null }>(expenses: E[], from: string, to: string): (E & { amountPaise: number })[] {
  return expenses.map((e) => ({ ...e, amountPaise: costInPeriod(e, from, to) })).filter((e) => e.amountPaise > 0)
}

/** Profit for the period: net sales (after returns) minus everything spent. */
export function profit(netSalesPaise: number, expensesPaise: number) {
  const p = netSalesPaise - expensesPaise
  return { profitPaise: p, marginPct: netSalesPaise > 0 ? Math.round((p / netSalesPaise) * 100) : null }
}

// ── Production per product (any farm) ─────────────────────────────────────────

export interface ProductionRow {
  productId: string
  made: number
  wasted: number
}

/** Good quantity a day's entry adds to stock. */
export const goodQty = (r: { made: number; wasted: number } | null | undefined) => (r ? Math.max(0, r.made - r.wasted) : 0)

/** How stock moves when a day's entry is saved: only the difference from what was saved before. */
export function productionStockDelta(before: { made: number; wasted: number } | null, after: { made: number; wasted: number }): number {
  return goodQty(after) - goodQty(before)
}

export function checkProduction(r: { made: number; wasted: number }): string | null {
  if (!Number.isFinite(r.made) || !Number.isFinite(r.wasted) || r.made < 0 || r.wasted < 0 || r.made > 10_000_000) return "record_invalid"
  if (r.wasted > r.made) return "wasted_more_than_made"
  return null
}

/** Totals per product over a period, biggest first. */
export function productionTotals(rows: ProductionRow[]): { productId: string; made: number; wasted: number; days: number }[] {
  const by = new Map<string, { productId: string; made: number; wasted: number; days: number }>()
  for (const r of rows) {
    const t = by.get(r.productId) ?? { productId: r.productId, made: 0, wasted: 0, days: 0 }
    t.made += r.made
    t.wasted += r.wasted
    t.days += 1
    by.set(r.productId, t)
  }
  const round = (n: number) => Math.round(n * 100) / 100
  return [...by.values()].map((t) => ({ ...t, made: round(t.made), wasted: round(t.wasted) })).sort((a, b) => b.made - a.made)
}

