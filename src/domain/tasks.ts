/**
 * Farm Core's jobs (docs/platform-plan.md §3.2), the pure part: when a job is due, where a repeating one moves when
 * it's done, and which machines and store items need doing something about today. Tested; src/server/tasks.ts loads
 * and saves.
 *
 * A job is once, or again every so many days, weeks or months. A repeating job done on time or early moves on from
 * the day it was due (it keeps its rhythm); done late, it moves on from the day it was done.
 */
import { addDays, addMonths, daysBetween } from "./ist"
import { serviceDue } from "./farm-core"
import { isLow } from "./inputs"

export const REPEAT_UNITS = ["day", "week", "month"] as const
export type RepeatUnit = (typeof REPEAT_UNITS)[number]

/** Machines due for a service within this many days come up on Today. */
export const SERVICE_SOON_DAYS = 3

export interface TaskTiming {
  dueOn: string
  repeatEvery: number | null
  repeatUnit: string | null
  doneOn: string | null
}

export const repeats = (t: Pick<TaskTiming, "repeatEvery" | "repeatUnit">) => !!t.repeatEvery && t.repeatEvery > 0 && (REPEAT_UNITS as readonly string[]).includes(t.repeatUnit ?? "")

/** The next day a repeating job is due once it's done on `doneOn`. */
export function nextDue(t: Pick<TaskTiming, "dueOn" | "repeatEvery" | "repeatUnit">, doneOn: string): string {
  const from = doneOn > t.dueOn ? doneOn : t.dueOn
  const n = t.repeatEvery ?? 1
  return t.repeatUnit === "month" ? addMonths(from, n) : addDays(from, t.repeatUnit === "week" ? n * 7 : n)
}

export type TaskState = "done" | "late" | "today" | "soon" | "later"

/** Late (past its day), today, soon (within a week), later; or done (a one-off that was done). */
export function taskState(t: TaskTiming, today: string): TaskState {
  if (t.doneOn) return "done"
  const days = daysBetween(today, t.dueOn)
  return days < 0 ? "late" : days === 0 ? "today" : days <= 7 ? "soon" : "later"
}

/** Jobs to show on Today: due today or late, not done. */
export const dueNow = <T extends TaskTiming>(tasks: T[], today: string) => tasks.filter((t) => !t.doneOn && t.dueOn <= today).sort((a, b) => a.dueOn.localeCompare(b.dueOn))

/** Who sees a job on Today: the one it's for; with no one named, the owner and managers. */
export const seesTask = (t: { forStaffId: string | null }, staff: { id: string; roles: readonly string[] }) =>
  t.forStaffId ? t.forStaffId === staff.id : staff.roles.some((r) => r === "owner" || r === "manager")

export type FarmReminder =
  | { kind: "service"; id: string; name: string; on: string; days: number }
  | { kind: "store"; id: string; name: string; left: number; unit: string }

/**
 * What the farm's own records say needs doing: machines due for a service (late, or within SERVICE_SOON_DAYS), and
 * store items at or below their warning level. The hens' feed is left out when its own "feed running out" warning
 * already says so (never two warnings for one thing).
 */
export function farmReminders(
  assets: { id: string; name: string; serviceEveryDays: number | null; lastServiceOn: string | null; boughtOn: string | null; retiredAt: Date | null }[],
  store: { item: { id: string; name: string; unit: string; lowAt: number | null; batchFeed: boolean; retiredAt: Date | null }; stock: { left: number } }[],
  today: string,
  feedWarned: boolean
): FarmReminder[] {
  const out: FarmReminder[] = []
  for (const a of assets) {
    if (a.retiredAt) continue
    const due = serviceDue(a, today)
    if (due && due.days <= SERVICE_SOON_DAYS) out.push({ kind: "service", id: a.id, name: a.name, on: due.on, days: due.days })
  }
  for (const { item, stock } of store) {
    if (item.retiredAt || (item.batchFeed && feedWarned)) continue
    if (isLow(stock.left, item.lowAt)) out.push({ kind: "store", id: item.id, name: item.name, left: stock.left, unit: item.unit })
  }
  return out
}
