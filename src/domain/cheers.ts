/**
 * What the farm app says after something is saved. Each notice states the fact first ("Loss noted · Batch #2 ·
 * 3 birds") and then adds one line from a pool that changes each time, so a person entering things all day is
 * told clearly that it worked and never reads the same line twice in a row.
 *
 * Tone follows the moment: happy for eggs, sales and deliveries; calm for settings and fixes; gentle for losses,
 * cancellations and removals (no time-of-day jokes and no milestone sparkle on a sad entry).
 * The words live in messages/*.json under "cheers"; this file decides which to show. Pure, so it is tested.
 */

export type CheerTone = "happy" | "calm" | "gentle"

export const CHEER_KINDS = {
  // Poultry
  eggs: "happy",
  loss: "gentle",
  day: "happy",
  allDays: "happy",
  batchAdded: "happy",
  batchSaved: "calm",
  batchClosed: "calm",
  dose: "happy",
  doseUndone: "calm",
  vaccinePlan: "calm",
  feed: "happy",
  weight: "happy",
  // Money
  expense: "calm",
  made: "happy",
  eggStore: "calm",
  payment: "happy",
  // Orders
  orderNew: "happy",
  orderSaved: "calm",
  confirmed: "happy",
  packed: "happy",
  onTheWay: "happy",
  delivered: "happy",
  cancelled: "gentle",
  called: "calm",
  returned: "calm",
  // Shop and settings
  product: "happy",
  customer: "calm",
  slot: "calm",
  plan: "happy",
  settings: "calm",
  deleted: "gentle",
} as const satisfies Record<string, CheerTone>

export type CheerKind = keyof typeof CHEER_KINDS
export const toneOf = (kind: CheerKind): CheerTone => CHEER_KINDS[kind]

/** Saves in a day that earn a small celebration (never on a gentle notice). */
export const MILESTONES = [5, 10, 20, 30, 50, 75, 100]

export type DayPart = "morning" | "afternoon" | "evening" | "night"

/**
 * Pick a line index from a pool of `size`, avoiding the ones shown most recently for this kind (up to half the
 * pool, so there is always a choice). `rand` is 0..1.
 */
export function pickLine(size: number, recent: number[], rand: number): number {
  if (size <= 1) return 0
  const avoid = new Set(recent.slice(-Math.floor(size / 2)))
  const choices = Array.from({ length: size }, (_, i) => i).filter((i) => !avoid.has(i))
  return choices[Math.min(choices.length - 1, Math.floor(rand * choices.length))]
}

export type CheerLine = { pool: "kind"; index: number } | { pool: "time"; part: DayPart; index: number } | { pool: "milestone"; index: number }

/**
 * Which line goes under the fact: a milestone celebration when today's count reaches one (happy and calm notices
 * only), now and then a line for the time of day (happy notices only), otherwise a fresh line for this kind.
 */
export function chooseLine(o: {
  kind: CheerKind
  kindSize: number
  recent: number[]
  timeSize: number
  part: DayPart
  milestoneSize: number
  countToday: number
  rand: () => number
}): CheerLine {
  const tone = toneOf(o.kind)
  if (tone !== "gentle" && MILESTONES.includes(o.countToday) && o.milestoneSize > 0) {
    return { pool: "milestone", index: Math.floor(o.rand() * o.milestoneSize) % o.milestoneSize }
  }
  if (tone === "happy" && o.timeSize > 0 && o.rand() < 0.2) {
    return { pool: "time", part: o.part, index: Math.floor(o.rand() * o.timeSize) % o.timeSize }
  }
  return { pool: "kind", index: pickLine(o.kindSize, o.recent, o.rand()) }
}

/**
 * The notice for a day's entry: any birds lost come first (gently), then eggs collected, else just "saved".
 * For several batches at once, losses name the batches they happened in; otherwise it counts the batches.
 */
export function dayCheer(rows: { name: string; eggs: number | null; lost: number }[]): { kind: CheerKind; values: Record<string, string | number> } {
  const lost = rows.filter((r) => r.lost > 0)
  if (lost.length) return { kind: "loss", values: { batch: lost.map((r) => r.name).join(", "), count: lost.reduce((a, r) => a + r.lost, 0) } }
  if (rows.length > 1) return { kind: "allDays", values: { count: rows.length } }
  const r = rows[0]
  if (r && (r.eggs ?? 0) > 0) return { kind: "eggs", values: { batch: r.name, eggs: r.eggs! } }
  return { kind: "day", values: { batch: r?.name ?? "" } }
}
