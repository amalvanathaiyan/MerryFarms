import { addDays, istDate } from "@/domain/ist"

/** Picks the Tamil or English variant of a bilingual field pair. */
export function pick(locale: string, ta: string, en: string): string
export function pick(locale: string, ta: string | null, en: string | null): string | null
export function pick(locale: string, ta: string | null, en: string | null) {
  return locale === "ta" ? ta || en : en || ta
}

/** "இன்று" / "நாளை" / "வியா., 23 அக்." for an IST "YYYY-MM-DD" date. */
export function dayLabel(date: string, locale: string, labels: { today: string; tomorrow: string }, now = new Date()) {
  const today = istDate(now)
  if (date === today) return labels.today
  if (date === addDays(today, 1)) return labels.tomorrow
  return new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`))
}

/** "7 PM" style time of an instant, in IST; minutes shown only when not on the hour. */
export function istTime(at: Date, locale: string) {
  const istMinute = (at.getUTCMinutes() + 30) % 60
  return new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", {
    hour: "numeric",
    minute: istMinute === 0 ? undefined : "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(at)
}

/** Short weekday names, Sunday first, in the given language. */
export function weekdayNames(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { weekday: "short", timeZone: "UTC" })
  // 2026-10-18 is a Sunday
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 9, 18 + i))))
}
