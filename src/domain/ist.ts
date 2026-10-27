/**
 * India Standard Time helpers.
 * Servers run in UTC, but farms, slots and cut-offs live in IST (UTC+05:30, no DST).
 * Dates are passed around as "YYYY-MM-DD" strings in IST so they never shift a day.
 */

const IST_OFFSET_MS = 330 * 60 * 1000

/** IST calendar date ("2026-10-21") for an instant. */
export function istDate(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Day of week in IST for a "YYYY-MM-DD" date (0 = Sunday). */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

/** Adds whole days to a "YYYY-MM-DD" date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The instant at which an IST wall-clock time ("07:30") occurs on an IST date. */
export function istInstant(date: string, time: string): Date {
  return new Date(new Date(`${date}T${time}:00Z`).getTime() - IST_OFFSET_MS)
}

/** Whole days from one IST date to another (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Financial year label for an instant, India: April–March, e.g. "2026-27". */
export function financialYear(at: Date): string {
  const [y, m] = istDate(at).split("-").map(Number)
  const start = m >= 4 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`
}
