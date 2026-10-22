import { istDate } from "@/domain/ist"

/** "10:42 am" today, else "21 Oct, 10:42 am" — in IST. */
export function chatTime(at: Date, locale: string) {
  const loc = locale === "ta" ? "ta-IN" : "en-IN"
  const time = new Intl.DateTimeFormat(loc, { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(at)
  if (istDate(at) === istDate(new Date())) return time
  const day = new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(at)
  return `${day}, ${time}`
}

/** Whole hours since a moment (for "waiting 3 hours" and "not seen for 2 hours"). */
export function hoursSince(at: Date) {
  return (Date.now() - at.getTime()) / 3_600_000
}
