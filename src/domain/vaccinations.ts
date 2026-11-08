/**
 * Vaccinations for batches: the farm's own plan by age, the doses each batch is due, and what was given.
 * No vaccine names or ages are built in: the farm (or its vet) sets them. Pure; dates IST.
 */
import { addDays, daysBetween } from "./ist"
import { hatchDate, onFarm, type BatchInfo } from "./batches"

export const VACCINE_METHODS = ["water", "eye_drop", "injection", "wing_stab", "spray", "other"] as const
export type VaccineMethod = (typeof VACCINE_METHODS)[number]

/** How soon a planned dose counts as "coming up" on the farm's screens. */
export const SOON_DAYS = 3

export interface ScheduleItem {
  vaccine: string
  ageDays: number
  method: string | null
}

export interface Vaccination {
  id: string
  batchId: string
  vaccine: string
  dueDate: string | null
  givenDate: string | null
}

/** The day a batch reaches an age: its hatch day plus that many days. */
export const dueDateFor = (b: Pick<BatchInfo, "startDate" | "ageAtStartDays">, ageDays: number) => addDays(hatchDate(b), ageDays)

/**
 * The doses a batch gets from the farm's plan: only those at or after its age on arrival (bought birds were
 * vaccinated before that by whoever raised them). Earliest first.
 */
export function planFor(b: Pick<BatchInfo, "startDate" | "ageAtStartDays">, schedule: ScheduleItem[]): { vaccine: string; method: string | null; dueDate: string }[] {
  return schedule
    .filter((s) => s.ageDays >= b.ageAtStartDays)
    .sort((x, y) => x.ageDays - y.ageDays)
    .map((s) => ({ vaccine: s.vaccine, method: s.method, dueDate: dueDateFor(b, s.ageDays) }))
}

export type DoseState = "given" | "overdue" | "today" | "soon" | "later" | "unplanned"

/** Where a dose stands on a day. */
export function doseState(v: Pick<Vaccination, "dueDate" | "givenDate">, today: string): DoseState {
  if (v.givenDate) return "given"
  if (!v.dueDate) return "unplanned"
  if (v.dueDate < today) return "overdue"
  if (v.dueDate === today) return "today"
  return daysBetween(today, v.dueDate) <= SOON_DAYS ? "soon" : "later"
}

/**
 * Doses to give now: not yet given, due today or before, for batches still on the farm. Most overdue first.
 * `daysLate` is 0 for today.
 */
export function dosesDue<V extends Vaccination>(vaccinations: V[], batches: Pick<BatchInfo, "id" | "startDate" | "closedDate">[], today: string): (V & { daysLate: number })[] {
  const live = new Set(batches.filter((b) => onFarm(b, today)).map((b) => b.id))
  return vaccinations
    .filter((v) => live.has(v.batchId) && !v.givenDate && v.dueDate && v.dueDate <= today)
    .map((v) => ({ ...v, daysLate: daysBetween(v.dueDate!, today) }))
    .sort((a, b) => b.daysLate - a.daysLate || a.vaccine.localeCompare(b.vaccine))
}

/** Checks a schedule line. Returns an error code, or null. */
export function checkScheduleItem(s: ScheduleItem): string | null {
  if (!s.vaccine.trim()) return "vaccine_name_required"
  if (!Number.isInteger(s.ageDays) || s.ageDays < 0 || s.ageDays > 3650) return "batch_age_invalid"
  if (s.method && !(VACCINE_METHODS as readonly string[]).includes(s.method)) return "record_invalid"
  return null
}

/**
 * Checks a dose being planned or marked given. A dose needs a name and a planned or given day; neither day can be
 * before the batch came, and the given day can't be in the future or after the batch finished.
 */
export function checkDose(
  b: Pick<BatchInfo, "startDate" | "closedDate" | "startCount">,
  d: { vaccine: string; method: string | null; dueDate: string | null; givenDate: string | null; birds: number | null; costPaise: number | null },
  today: string
): string | null {
  if (!d.vaccine.trim()) return "vaccine_name_required"
  if (!d.dueDate && !d.givenDate) return "vaccine_day_required"
  if (d.method && !(VACCINE_METHODS as readonly string[]).includes(d.method)) return "record_invalid"
  if (d.givenDate) {
    if (d.givenDate > today) return "record_future"
    if (d.givenDate < b.startDate) return "batch_before_start"
    if (b.closedDate && d.givenDate > b.closedDate) return "batch_closed"
  }
  if (d.dueDate && d.dueDate < b.startDate) return "batch_before_start"
  if (d.birds != null && (!Number.isInteger(d.birds) || d.birds < 0 || d.birds > b.startCount)) return "vaccine_birds_invalid"
  if (d.costPaise != null && (!Number.isInteger(d.costPaise) || d.costPaise < 0)) return "record_invalid"
  return null
}
