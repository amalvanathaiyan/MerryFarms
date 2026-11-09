/**
 * Warnings that come before problems grow: unusual losses in a batch, feed running out, eggs dropping.
 * Pure: everything is worked out from the batches' daily entries and the feed store. Dates IST.
 */
import { addDays } from "./ist"
import { batchStatus, onFarm, type BatchDayRow, type BatchInfo, type BatchLossRow } from "./batches"

export type Alert =
  | { kind: "losses"; batchId: string; batchName: string; date: string; lost: number; usual: number }
  | { kind: "feed"; daysLeft: number; leftKg: number; perDay: number }
  | { kind: "laying"; batchId: string; batchName: string; before: number; now: number }

/** Feed lasting this many days or fewer is "running out". */
export const FEED_DAYS_WARNING = 7

const lossesOn = (losses: BatchLossRow[], batchId: string, date: string) => losses.filter((l) => l.batchId === batchId && l.date === date).reduce((a, l) => a + l.count, 0)
const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Unusual losses on a day: 3 or more birds and more than twice the batch's usual daily losses over the 7 days
 * before, or 5% or more of the birds it had that morning (so a small batch losing 2 of 30 is noticed too).
 */
export function unusualLosses(b: BatchInfo, days: BatchDayRow[], losses: BatchLossRow[], date: string): { lost: number; usual: number } | null {
  const lost = lossesOn(losses, b.id, date)
  if (lost < 2) return null
  // The week before, over the days that were entered (a day not entered is unknown, not "no losses").
  const week = Array.from({ length: 7 }, (_, i) => addDays(date, -(i + 1))).filter(
    (d) => d >= b.startDate && (days.some((x) => x.batchId === b.id && x.date === d) || losses.some((x) => x.batchId === b.id && x.date === d))
  )
  const usual = week.length ? week.reduce((a, d) => a + lossesOn(losses, b.id, d), 0) / week.length : 0
  const morning = batchStatus(b, days, losses, addDays(date, -1)).alive || b.startCount
  const unusual = (lost >= 3 && lost > 2 * usual) || lost / morning >= 0.05
  return unusual ? { lost, usual: round1(usual) } : null
}

/** Good eggs per bird alive, as a percentage, on each entered day (laying batches only). */
function layingByDay(b: BatchInfo, days: BatchDayRow[], losses: BatchLossRow[]) {
  return days
    .filter((d) => d.batchId === b.id && d.eggsCollected != null)
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((d) => {
      const alive = batchStatus(b, days, losses, addDays(d.date, -1)).alive || b.startCount
      const good = Math.max(0, (d.eggsCollected ?? 0) - (d.eggsBroken ?? 0))
      return { date: d.date, rate: alive > 0 ? (good / alive) * 100 : 0 }
    })
}

/**
 * Egg laying dropped: the last 3 entered days average at least a fifth below the 7 entered days before them, for
 * a batch that was really laying (20% or more). Needs enough days to compare.
 */
export function layingDrop(b: BatchInfo, days: BatchDayRow[], losses: BatchLossRow[], today: string): { before: number; now: number } | null {
  const rates = layingByDay(b, days, losses).filter((r) => r.date <= today)
  if (rates.length < 8) return null
  const recent = rates.slice(-3)
  const earlier = rates.slice(-10, -3)
  const avg = (xs: { rate: number }[]) => xs.reduce((a, x) => a + x.rate, 0) / xs.length
  const before = avg(earlier)
  const now = avg(recent)
  if (before < 20 || now > before * 0.8) return null
  return { before: Math.round(before), now: Math.round(now) }
}

/**
 * Days of feed left at the recent rate (feed given per entered day over the last 7 days). Null when there is no
 * feed store yet or no recent feeding to go by.
 */
export function feedDaysLeft(feed: { boughtKg: number; leftKg: number }, days: BatchDayRow[], today: string): { daysLeft: number; perDay: number } | null {
  if (feed.boughtKg <= 0) return null
  const weekAgo = addDays(today, -6)
  const recent = days.filter((d) => d.date >= weekAgo && d.date <= today && (d.feedKg ?? 0) > 0)
  const dates = new Set(recent.map((d) => d.date)).size
  if (!dates) return null
  const perDay = round1(recent.reduce((a, d) => a + (d.feedKg ?? 0), 0) / dates)
  return { daysLeft: Math.max(0, Math.floor(feed.leftKg / perDay)), perDay }
}

/**
 * Every warning for a farm today. Losses are looked at for today, and for yesterday when a batch hasn't been
 * entered today yet (so a bad day isn't missed overnight).
 */
export function farmAlerts(
  batches: BatchInfo[],
  days: BatchDayRow[],
  losses: BatchLossRow[],
  feed: { boughtKg: number; leftKg: number } | null,
  today: string
): Alert[] {
  const out: Alert[] = []
  const yesterday = addDays(today, -1)
  for (const b of batches.filter((x) => onFarm(x, today))) {
    const enteredToday = days.some((d) => d.batchId === b.id && d.date === today) || losses.some((l) => l.batchId === b.id && l.date === today)
    const date = enteredToday ? today : yesterday
    const hit = date >= b.startDate ? unusualLosses(b, days, losses, date) : null
    if (hit) out.push({ kind: "losses", batchId: b.id, batchName: b.name, date, ...hit })
    const drop = b.purpose !== "meat" ? layingDrop(b, days, losses, today) : null
    if (drop) out.push({ kind: "laying", batchId: b.id, batchName: b.name, ...drop })
  }
  const f = feed ? feedDaysLeft(feed, days, today) : null
  if (f && feed && f.daysLeft <= FEED_DAYS_WARNING) out.push({ kind: "feed", daysLeft: f.daysLeft, leftKg: round1(feed.leftKg), perDay: f.perDay })
  return out
}

/** Batches on the farm today that have nothing entered for today (for the evening reminder). */
export function batchesNotEntered(batches: BatchInfo[], days: BatchDayRow[], losses: BatchLossRow[], today: string): BatchInfo[] {
  return batches.filter((b) => onFarm(b, today) && !days.some((d) => d.batchId === b.id && d.date === today) && !losses.some((l) => l.batchId === b.id && l.date === today))
}
