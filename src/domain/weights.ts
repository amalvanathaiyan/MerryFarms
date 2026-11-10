/**
 * Weighing a few birds of a batch, usually once a week, to follow how they grow.
 * A weighing is "N birds weighed, together T grams"; the average bird is T / N. Pure, so it is tested.
 */
import { daysBetween } from "./ist"
import { ageDays, onFarm, type BatchInfo } from "./batches"

export interface WeightRow {
  date: string
  birds: number
  totalGrams: number
}

/** How often a batch should be weighed. */
export const WEIGH_EVERY_DAYS = 7
/** Most birds in one weighing (a sample, not the flock). */
export const MAX_WEIGHED = 500
/** An average outside this is almost always a slip (grams typed as kilos, or the other way). */
export const BIRD_GRAMS = { min: 20, max: 8000 }

export const avgGrams = (r: Pick<WeightRow, "birds" | "totalGrams">) => (r.birds > 0 ? Math.round(r.totalGrams / r.birds) : 0)

export interface WeightPoint {
  date: string
  /** Age of the birds that day, in days from hatching. */
  ageDays: number
  birds: number
  avgGrams: number
  /** Grams gained per bird per day since the weighing before; null for the first. */
  gainPerDay: number | null
}

/** The batch's weighings in date order, with age and growth since the one before. */
export function weightPoints(b: Pick<BatchInfo, "startDate" | "ageAtStartDays">, rows: WeightRow[]): WeightPoint[] {
  const sorted = [...rows].sort((x, y) => x.date.localeCompare(y.date))
  return sorted.map((r, i) => {
    const prev = sorted[i - 1]
    const avg = avgGrams(r)
    const gap = prev ? daysBetween(prev.date, r.date) : 0
    return {
      date: r.date,
      ageDays: ageDays(b, r.date),
      birds: r.birds,
      avgGrams: avg,
      gainPerDay: prev && gap > 0 ? Math.round((avg - avgGrams(prev)) / gap) : null,
    }
  })
}

/**
 * Whether the batch should be weighed now: it is on the farm and has never been weighed, or the last weighing
 * was a week or more ago. `daysSince` is null when it has never been weighed.
 */
export function weighDue(b: Pick<BatchInfo, "startDate" | "closedDate">, rows: WeightRow[], today: string): { due: boolean; daysSince: number | null } {
  if (!onFarm(b, today)) return { due: false, daysSince: null }
  const last = rows.reduce<string | null>((a, r) => (r.date <= today && (!a || r.date > a) ? r.date : a), null)
  const daysSince = last ? daysBetween(last, today) : null
  return { due: daysSince == null || daysSince >= WEIGH_EVERY_DAYS, daysSince }
}

/** Problems with a weighing before it is saved (error codes, worded in messages/*.json under errors). */
export function checkWeight(b: Pick<BatchInfo, "startDate" | "closedDate">, w: WeightRow, today: string): string | null {
  if (w.date < b.startDate || w.date > today || (b.closedDate && w.date > b.closedDate)) return "weight_date"
  if (!Number.isInteger(w.birds) || w.birds < 1 || w.birds > MAX_WEIGHED) return "weight_birds"
  if (!Number.isInteger(w.totalGrams) || w.totalGrams <= 0) return "weight_total"
  const avg = avgGrams(w)
  if (avg < BIRD_GRAMS.min || avg > BIRD_GRAMS.max) return "weight_odd"
  return null
}

/** "850 g" under a kilo, "1.25 kg" from a kilo up (the screens add the unit words). */
export function weightText(grams: number): { value: string; unit: "g" | "kg" } {
  if (grams < 1000) return { value: String(Math.round(grams)), unit: "g" }
  // Round on whole tens of grams (1305 g is 1.31 kg), and no trailing zeros: 2 kg, 1.3 kg, 1.25 kg.
  return { value: String(Math.round(grams / 10) / 100), unit: "kg" }
}
