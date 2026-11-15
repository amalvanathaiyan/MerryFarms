/**
 * Fishery (docs/platform-plan.md §3.1), the pure part: the kinds of fish, what's in a pond (stocked, dead, left),
 * how big they are from net samples, how well feed turns into fish, and when the water needs attention. Tested;
 * src/server/fish.ts loads and saves.
 */
import { daysBetween } from "./ist"

/** Fish (and shrimp) farmed in South India. A farm can also type its own. Banned kinds (African catfish, Thai magur)
 *  are never offered; the restricted-items list catches them on products. */
export const FISH_SPECIES = ["rohu", "catla", "mrigal", "common_carp", "grass_carp", "silver_carp", "tilapia", "pangasius", "murrel", "vannamei", "scampi"] as const
export type FishSpecies = (typeof FISH_SPECIES)[number]
export const isFishSpecies = (s: string): s is FishSpecies => (FISH_SPECIES as readonly string[]).includes(s)

export interface Stocked {
  species: string
  count: number
  sizeGrams: number | null
}

/** What's in the pond: put in, found dead, taken out (harvested), and left. */
export function pondStock(stockings: Stocked[], days: { dead: number }[], harvestedCount = 0) {
  const stocked = stockings.reduce((a, s) => a + s.count, 0)
  const dead = days.reduce((a, d) => a + d.dead, 0)
  const left = Math.max(0, stocked - dead - harvestedCount)
  return { stocked, dead, harvested: harvestedCount, left, survivalPct: stocked > 0 ? Math.round(((stocked - dead) / stocked) * 1000) / 10 : null }
}

/** Fish of each kind put in, biggest first (for a mixed pond: "Rohu 2,000 · Catla 1,000"). */
export function speciesMix(stockings: Stocked[]) {
  const by = new Map<string, number>()
  for (const s of stockings) by.set(s.species, (by.get(s.species) ?? 0) + s.count)
  return [...by].map(([species, count]) => ({ species, count })).sort((a, b) => b.count - a.count)
}

/** The average weight (grams) from the latest net sample, of one kind or (species null) of all of them. */
export function latestAverage(samples: { date: string; createdAt?: Date; species: string | null; count: number; totalGrams: number }[]): { date: string; grams: number } | null {
  const valid = samples.filter((s) => s.count > 0 && s.totalGrams > 0)
  if (!valid.length) return null
  const lastDay = valid.reduce((a, s) => (s.date > a ? s.date : a), "")
  const that = valid.filter((s) => s.date === lastDay)
  const count = that.reduce((a, s) => a + s.count, 0)
  const grams = that.reduce((a, s) => a + s.totalGrams, 0)
  return { date: lastDay, grams: Math.round((grams / count) * 10) / 10 }
}

/**
 * The fish in the pond by weight (kg), estimated from the fish left and their latest average weight; and how much
 * feed each kg of growth took (FCR: lower is better; carps are usually 1.5–2). Null when there's no sample yet.
 */
export function pondWeight(left: number, average: { grams: number } | null, stockings: Stocked[], feedKg: number) {
  if (!average) return null
  const kg = Math.round(((left * average.grams) / 1000) * 10) / 10
  const putInKg = stockings.reduce((a, s) => a + (s.sizeGrams ?? 0) * s.count, 0) / 1000
  const gain = kg - putInKg
  return { kg, fcr: gain > 0 && feedKg > 0 ? Math.round((feedKg / gain) * 100) / 100 : null }
}

// ── Water ─────────────────────────────────────────────────────────────────────────────────────────────────────

export const WATER_CHECKS = ["ph", "oxygen", "tempC", "ammonia"] as const
export type WaterCheck = (typeof WATER_CHECKS)[number]

/**
 * Safe ranges for warm-water fish (carps, tilapia, murrel) as fisheries officers advise; outside "ok" is a warning,
 * outside "danger" needs doing something today (aerate, change water, stop feeding).
 */
export const WATER_LIMITS: Record<WaterCheck, { ok: [number, number]; danger: [number, number] }> = {
  ph: { ok: [6.5, 8.5], danger: [6, 9] },
  oxygen: { ok: [5, Infinity], danger: [3, Infinity] },
  tempC: { ok: [25, 32], danger: [20, 35] },
  ammonia: { ok: [0, 0.5], danger: [0, 1] },
}

export type WaterWarning = { check: WaterCheck; value: number; side: "low" | "high"; danger: boolean }

/** The readings outside the safe range, worst first. */
export function waterWarnings(day: Partial<Record<WaterCheck, number | null>>): WaterWarning[] {
  const out: WaterWarning[] = []
  for (const check of WATER_CHECKS) {
    const v = day[check]
    if (v == null) continue
    const { ok, danger } = WATER_LIMITS[check]
    if (v >= ok[0] && v <= ok[1]) continue
    out.push({ check, value: v, side: v < ok[0] ? "low" : "high", danger: v < danger[0] || v > danger[1] })
  }
  return out.sort((a, b) => Number(b.danger) - Number(a.danger))
}

/** Plausible readings only (a typo like pH 75 is refused, not warned about). */
export const WATER_BOUNDS: Record<WaterCheck, [number, number]> = { ph: [0, 14], oxygen: [0, 30], tempC: [0, 50], ammonia: [0, 20] }
export const waterReadingOk = (check: WaterCheck, v: number) => Number.isFinite(v) && v >= WATER_BOUNDS[check][0] && v <= WATER_BOUNDS[check][1]

// ── Harvest and profit ─────────────────────────────────────────────────────────────────────────────────────────

/** Fish taken out: counted, or worked out from the kg and the latest size (none without a size). */
export function harvestedCount(harvests: { kg: number; count: number | null }[], average: { grams: number } | null) {
  return harvests.reduce((a, h) => a + (h.count ?? (average && average.grams > 0 ? Math.round((h.kg * 1000) / average.grams) : 0)), 0)
}

/**
 * A cycle's money: what the harvests sold for, against everything spent on its pond while it ran (fingerlings and
 * other spending, store items used there, workers' days there). Fish kept for the shop or home earn nothing here
 * (the shop's sales show in Money), so their kg still bring the cost of each kg down.
 */
export function cycleMoney(p: { soldPaise: number; spentPaise: number; storePaise: number; labourPaise: number; harvestKg: number }) {
  const costs = p.spentPaise + p.storePaise + p.labourPaise
  return { income: p.soldPaise, costs, profit: p.soldPaise - costs, costPerKgPaise: p.harvestKg > 0 ? Math.round(costs / p.harvestKg) : null }
}

// ── Reminders ─────────────────────────────────────────────────────────────────────────────────────────────────

/** A size check is due when the last one (or the stocking) is this many days old. */
export const SAMPLE_EVERY_DAYS = 30
/** Water readings older than this aren't warned about any more (a newer check is what counts). */
export const WATER_FRESH_DAYS = 2

export type PondReminder =
  | { kind: "water"; cycleId: string; pond: string; date: string; warnings: WaterWarning[]; danger: boolean }
  | { kind: "sample"; cycleId: string; pond: string; since: string }

/** What each running pond needs: its latest water checks out of range (recent ones only), and a size check due. */
export function pondReminders(
  cycles: { id: string; pond: string; startDate: string; lastWater: { date: string; warnings: WaterWarning[] } | null; lastSampleDate: string | null }[],
  today: string
): PondReminder[] {
  const out: PondReminder[] = []
  for (const c of cycles) {
    if (c.lastWater && c.lastWater.warnings.length && daysBetween(c.lastWater.date, today) <= WATER_FRESH_DAYS) {
      out.push({ kind: "water", cycleId: c.id, pond: c.pond, date: c.lastWater.date, warnings: c.lastWater.warnings, danger: c.lastWater.warnings.some((w) => w.danger) })
    }
    const since = c.lastSampleDate ?? c.startDate
    if (daysBetween(since, today) >= SAMPLE_EVERY_DAYS) out.push({ kind: "sample", cycleId: c.id, pond: c.pond, since })
  }
  return out.sort((a, b) => Number(b.kind === "water" && b.danger) - Number(a.kind === "water" && a.danger))
}
