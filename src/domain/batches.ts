/**
 * Batches: birds (or other animals) that came onto the farm together, bought in or hatched here.
 * Everything about a batch on any day is worked out from its first day, its age then, its chick count and
 * the daily entries up to that day, so any past day can be looked at. Pure; money in paise, dates IST.
 */
import { addDays, daysBetween } from "./ist"
import type { DayRecord } from "./records"

export const BATCH_PURPOSES = ["eggs", "meat", "breeding"] as const
export type BatchPurpose = (typeof BATCH_PURPOSES)[number]
/** Where a batch came from: chicks bought in, eggs bought and hatched here, or the farm's own eggs hatched here. */
export const BATCH_SOURCES = ["bought", "eggs_bought", "hatched"] as const
export type BatchSource = (typeof BATCH_SOURCES)[number]
/** Bought from someone (has a supplier and a price): chicks, or eggs to hatch. */
export const boughtIn = (source: string) => source === "bought" || source === "eggs_bought"
/** Hatched on the farm (first day = hatch day, eggs set, hatch rate): from bought eggs or the farm's own. */
export const hatchedHere = (source: string) => source === "hatched" || source === "eggs_bought"
/** Why birds were lost. "culled" is taken out on purpose (sick, weak); the rest died. */
export const LOSS_CAUSES = ["disease", "predator", "heat", "weak", "injury", "unknown", "culled"] as const
export type LossCause = (typeof LOSS_CAUSES)[number]

export interface BatchInfo {
  id: string
  number: number
  name: string
  purpose: string
  source: string
  startDate: string
  ageAtStartDays: number
  startCount: number
  closedDate: string | null
  eggValuePaise: number | null
}

export interface BatchDayRow {
  batchId: string
  date: string
  feedKg: number | null
  eggsCollected: number | null
  eggsBroken: number | null
  sold: number
  soldPaise: number
  given: number
}

export interface BatchLossRow {
  batchId: string
  date: string
  cause: string
  count: number
}

/** The day the birds hatched: the first day on the farm minus their age then. */
export const hatchDate = (b: Pick<BatchInfo, "startDate" | "ageAtStartDays">) => addDays(b.startDate, -b.ageAtStartDays)

/** Age in days on a date (0 on the hatch day). */
export const ageDays = (b: Pick<BatchInfo, "startDate" | "ageAtStartDays">, on: string) => daysBetween(hatchDate(b), on)

/** "3 weeks 2 days" as numbers, for the screens to word. */
export const weeksAndDays = (days: number) => ({ weeks: Math.floor(days / 7), days: days % 7 })

/** Which day on the farm a date is: the first day is day 1. */
export const dayOnFarm = (b: Pick<BatchInfo, "startDate">, on: string) => daysBetween(b.startDate, on) + 1

/** On the farm that day: arrived by then and not yet closed before it. */
export const onFarm = (b: Pick<BatchInfo, "startDate" | "closedDate">, on: string) => b.startDate <= on && (!b.closedDate || b.closedDate >= on)

export interface BatchStatus {
  /** False when the batch hadn't come yet on that date. */
  arrived: boolean
  closed: boolean
  ageDays: number
  dayOnFarm: number
  lost: number
  died: number
  culled: number
  lostByCause: { cause: string; count: number }[]
  sold: number
  soldPaise: number
  given: number
  alive: number
  /** Birds lost as a share of chicks at the start, one decimal. */
  lossPct: number
  feedKg: number
  eggsCollected: number
  eggsBroken: number
  daysEntered: number
  lastEntry: string | null
}

/** A batch as it stood at the end of `asOf`: only entries up to that day count. */
export function batchStatus(b: BatchInfo, days: BatchDayRow[], losses: BatchLossRow[], asOf: string): BatchStatus {
  const mine = days.filter((d) => d.batchId === b.id && d.date <= asOf)
  const lossRows = losses.filter((l) => l.batchId === b.id && l.date <= asOf)
  const by = new Map<string, number>()
  for (const l of lossRows) by.set(l.cause, (by.get(l.cause) ?? 0) + l.count)
  const lost = lossRows.reduce((a, l) => a + l.count, 0)
  const culled = by.get("culled") ?? 0
  const sum = (f: (d: BatchDayRow) => number | null) => mine.reduce((a, d) => a + (f(d) ?? 0), 0)
  const sold = sum((d) => d.sold)
  const given = sum((d) => d.given)
  const entered = [...new Set([...mine.map((d) => d.date), ...lossRows.map((l) => l.date)])].sort()
  return {
    arrived: b.startDate <= asOf,
    closed: !!b.closedDate && b.closedDate <= asOf,
    ageDays: ageDays(b, asOf),
    dayOnFarm: dayOnFarm(b, asOf),
    lost,
    died: lost - culled,
    culled,
    lostByCause: [...by.entries()].map(([cause, count]) => ({ cause, count })).sort((x, y) => y.count - x.count),
    sold,
    soldPaise: sum((d) => d.soldPaise),
    given,
    alive: Math.max(0, b.startCount - lost - sold - given),
    lossPct: b.startCount > 0 ? Math.round((lost / b.startCount) * 1000) / 10 : 0,
    feedKg: Math.round(sum((d) => d.feedKg) * 10) / 10,
    eggsCollected: sum((d) => d.eggsCollected),
    eggsBroken: sum((d) => d.eggsBroken),
    daysEntered: entered.length,
    lastEntry: entered.at(-1) ?? null,
  }
}

/** Birds that leave a batch in one day's entry. */
export const outOnDay = (d: { sold: number; given: number }, losses: { count: number }[]) => d.sold + d.given + losses.reduce((a, l) => a + l.count, 0)

/**
 * Checks one day's entry. `outOtherDays` is everything that left the batch on its other days; together they can
 * never be more than the chicks it started with. Returns an error code, or null.
 */
export function checkBatchDay(
  b: Pick<BatchInfo, "startDate" | "closedDate" | "startCount">,
  day: { date: string; feedKg: number | null; eggsCollected: number | null; eggsBroken: number | null; sold: number; soldPaise: number; given: number },
  losses: { cause: string; count: number }[],
  outOtherDays: number,
  today: string
): string | null {
  if (day.date > today) return "record_future"
  if (day.date < b.startDate) return "batch_before_start"
  if (b.closedDate && day.date > b.closedDate) return "batch_closed"
  const counts = [day.eggsCollected, day.eggsBroken, day.sold, day.given, day.soldPaise, ...losses.map((l) => l.count)]
  if (counts.some((v) => v != null && (!Number.isInteger(v) || v < 0))) return "record_invalid"
  if (day.feedKg != null && (!Number.isFinite(day.feedKg) || day.feedKg < 0 || day.feedKg > 100_000)) return "record_invalid"
  if (losses.some((l) => !(LOSS_CAUSES as readonly string[]).includes(l.cause))) return "record_invalid"
  if (day.eggsBroken != null && day.eggsCollected != null && day.eggsBroken > day.eggsCollected) return "broken_more_than_collected"
  if (day.soldPaise > 0 && day.sold === 0) return "sold_money_without_birds"
  if (outOtherDays + outOnDay(day, losses) > b.startCount) return "more_out_than_birds"
  return null
}

/** Checks a new or changed batch. `outSoFar`/`firstEntry` come from its entries when it already has some. */
export function checkBatch(
  b: { startDate: string; ageAtStartDays: number; startCount: number; source: string; eggsSet: number | null },
  today: string,
  existing?: { outSoFar: number; firstEntry: string | null }
): string | null {
  if (b.startDate > today) return "record_future"
  if (!Number.isInteger(b.startCount) || b.startCount < 1 || b.startCount > 1_000_000) return "batch_count_invalid"
  if (!Number.isInteger(b.ageAtStartDays) || b.ageAtStartDays < 0 || b.ageAtStartDays > 3650) return "batch_age_invalid"
  if (hatchedHere(b.source) && b.eggsSet != null && b.eggsSet < b.startCount) return "hatched_more_than_set"
  if (existing && b.startCount < existing.outSoFar) return "batch_count_below_out"
  if (existing?.firstEntry && b.startDate > existing.firstEntry) return "batch_start_after_entries"
  return null
}

/** Eggs that hatched, as a percentage of eggs set; null without a count of eggs set. */
export const hatchRatePct = (b: { eggsSet: number | null; startCount: number }) => (b.eggsSet && b.eggsSet > 0 ? Math.round((b.startCount / b.eggsSet) * 1000) / 10 : null)

// ── Feed store ────────────────────────────────────────────────────────────────

export interface FeedStore {
  boughtKg: number
  usedKg: number
  /** Can be below 0 when purchases weren't all entered with their kg. */
  leftKg: number
  /** Average price of feed bought with its kg; null until some is. */
  pricePerKgPaise: number | null
}

/** Feed bought (feed expenses with their kg) against feed used (daily entries). */
export function feedStore(purchases: { quantityKg: number | null; amountPaise: number }[], usedKg: number): FeedStore {
  const withKg = purchases.filter((p) => p.quantityKg != null && p.quantityKg > 0)
  const boughtKg = withKg.reduce((a, p) => a + p.quantityKg!, 0)
  const paid = withKg.reduce((a, p) => a + p.amountPaise, 0)
  const round = (n: number) => Math.round(n * 10) / 10
  return { boughtKg: round(boughtKg), usedKg: round(usedKg), leftKg: round(boughtKg - usedKg), pricePerKgPaise: boughtKg > 0 ? Math.round(paid / boughtKg) : null }
}

// ── Money per batch ───────────────────────────────────────────────────────────

export interface BatchMoney {
  chicksPaise: number
  /** Feed the batch ate, at the average price per kg; null when that price isn't known yet. */
  feedPaise: number | null
  /** Medicine, vaccines and anything else spent on this batch. */
  otherPaise: number
  costPaise: number
  birdsSoldPaise: number
  /** Good eggs at the batch's egg value; null without one. */
  eggsValuePaise: number | null
  inPaise: number
  marginPaise: number
  /** Everything spent on the batch so far per chick it started with. */
  costPerBirdPaise: number
  /** Birds lost, each at that cost per bird. */
  lostValuePaise: number
  /** Everything spent per good egg; null without eggs. */
  costPerEggPaise: number | null
}

/**
 * A batch's own money: what came in from it (birds sold, its eggs) against what was spent on it directly
 * (chicks, its feed, medicine). Farm-wide costs like labour and electricity stay in the farm's profit.
 */
export function batchMoney(
  b: Pick<BatchInfo, "startCount" | "eggValuePaise">,
  s: Pick<BatchStatus, "feedKg" | "soldPaise" | "eggsCollected" | "eggsBroken" | "lost">,
  spent: { kind: string; amountPaise: number }[],
  feedPricePerKgPaise: number | null
): BatchMoney {
  const chicksPaise = spent.filter((e) => e.kind === "chicks").reduce((a, e) => a + e.amountPaise, 0)
  const otherPaise = spent.filter((e) => e.kind !== "chicks").reduce((a, e) => a + e.amountPaise, 0)
  const feedPaise = s.feedKg > 0 ? (feedPricePerKgPaise != null ? Math.round(s.feedKg * feedPricePerKgPaise) : null) : 0
  const costPaise = chicksPaise + (feedPaise ?? 0) + otherPaise
  const goodEggs = Math.max(0, s.eggsCollected - s.eggsBroken)
  const eggsValuePaise = goodEggs > 0 && b.eggValuePaise != null ? goodEggs * b.eggValuePaise : goodEggs > 0 ? null : 0
  const inPaise = s.soldPaise + (eggsValuePaise ?? 0)
  const costPerBirdPaise = b.startCount > 0 ? Math.round(costPaise / b.startCount) : 0
  return {
    chicksPaise,
    feedPaise,
    otherPaise,
    costPaise,
    birdsSoldPaise: s.soldPaise,
    eggsValuePaise,
    inPaise,
    marginPaise: inPaise - costPaise,
    costPerBirdPaise,
    lostValuePaise: s.lost * costPerBirdPaise,
    costPerEggPaise: goodEggs > 0 && costPaise > 0 ? Math.round(costPaise / goodEggs) : null,
  }
}

// ── The whole flock, day by day ───────────────────────────────────────────────

/**
 * Farm-wide figures per day from all batches, for the profit report: eggs, birds on the farm at the end of the
 * day, birds lost and feed. Only days with an entry in [from, to] are returned.
 */
export function flockDays(batches: BatchInfo[], days: BatchDayRow[], losses: BatchLossRow[], from: string, to: string): DayRecord[] {
  const dates = [...new Set([...days.map((d) => d.date), ...losses.map((l) => l.date)])].filter((d) => d >= from && d <= to).sort()
  return dates.map((date) => {
    const today = days.filter((d) => d.date === date)
    const total = (f: (d: BatchDayRow) => number | null) => (today.some((d) => f(d) != null) ? today.reduce((a, d) => a + (f(d) ?? 0), 0) : null)
    const feed = total((d) => d.feedKg)
    return {
      date,
      eggsCollected: total((d) => d.eggsCollected),
      eggsBroken: total((d) => d.eggsBroken),
      birds: batches.filter((b) => onFarm(b, date)).reduce((a, b) => a + batchStatus(b, days, losses, date).alive, 0),
      birdsLost: losses.filter((l) => l.date === date).reduce((a, l) => a + l.count, 0),
      feedKg: feed == null ? null : Math.round(feed * 10) / 10,
    }
  })
}

/** Birds lost in a period, by cause, biggest first. */
export function lossesByCause(losses: BatchLossRow[]): { cause: string; count: number }[] {
  const by = new Map<string, number>()
  for (const l of losses) by.set(l.cause, (by.get(l.cause) ?? 0) + l.count)
  return [...by.entries()].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count)
}

/**
 * Birds lost in a period by cause, in ₹: each bird at what its own batch has cost per bird so far
 * (`costPerBirdPaise` by batch id; a batch without costs counts ₹0). Biggest loss in ₹ first.
 */
export function lossesValued(losses: BatchLossRow[], costPerBirdPaise: Map<string, number>): { cause: string; count: number; valuePaise: number }[] {
  const by = new Map<string, { count: number; valuePaise: number }>()
  for (const l of losses) {
    const row = by.get(l.cause) ?? { count: 0, valuePaise: 0 }
    row.count += l.count
    row.valuePaise += l.count * (costPerBirdPaise.get(l.batchId) ?? 0)
    by.set(l.cause, row)
  }
  return [...by.entries()].map(([cause, r]) => ({ cause, ...r })).sort((a, b) => b.valuePaise - a.valuePaise || b.count - a.count)
}
