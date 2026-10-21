import { addDays, istDate, istInstant, weekday } from "./ist"

export interface SlotRule {
  id: string
  startTime: string // "07:00" IST
  endTime: string // "09:00" IST
  daysOfWeek: number[] // 0 = Sunday
  cutoffHours: number
  maxOrders: number
  isActive: boolean
}

export interface SlotOption {
  slotId: string
  date: string // IST "YYYY-MM-DD"
  key: string // `${date}|${slotId}`
  cutoffAt: Date
  booked: number
  left: number
  full: boolean
}

export const slotKey = (date: string, slotId: string) => `${date}|${slotId}`

/** "7–9 AM", "11 AM–1 PM", "5:30–7 PM" */
export function slotRangeLabel(startTime: string, endTime: string): string {
  const part = (hm: string) => {
    const [h, m] = hm.split(":").map(Number)
    const ap = h >= 12 ? "PM" : "AM"
    const h12 = h % 12 || 12
    return { text: m ? `${h12}:${String(m).padStart(2, "0")}` : String(h12), ap }
  }
  const a = part(startTime)
  const b = part(endTime)
  return a.ap === b.ap ? `${a.text}–${b.text} ${b.ap}` : `${a.text} ${a.ap}–${b.text} ${b.ap}`
}

export function validateSlotRule(s: Pick<SlotRule, "startTime" | "endTime" | "daysOfWeek" | "cutoffHours" | "maxOrders">): string | null {
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!hm.test(s.startTime) || !hm.test(s.endTime)) return "time_format"
  if (s.startTime >= s.endTime) return "end_before_start"
  if (s.daysOfWeek.length === 0) return "no_days"
  if (s.daysOfWeek.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "bad_day"
  if (!Number.isInteger(s.cutoffHours) || s.cutoffHours < 0 || s.cutoffHours > 168) return "bad_cutoff"
  if (!Number.isInteger(s.maxOrders) || s.maxOrders < 1) return "bad_capacity"
  return null
}

/**
 * Upcoming delivery options a customer can still pick.
 * A slot occurrence is open until `start - cutoffHours`; it is marked full once
 * `bookedCounts[key]` reaches maxOrders (full ones are returned so the UI can show them).
 * Stops once `wantOpen` open options are found or `daysAhead` days are scanned.
 */
export function upcomingSlots(
  slots: SlotRule[],
  bookedCounts: Record<string, number>,
  now: Date,
  opts: { daysAhead?: number; wantOpen?: number } = {}
): SlotOption[] {
  const daysAhead = opts.daysAhead ?? 10
  const wantOpen = opts.wantOpen ?? 4
  const active = slots.filter((s) => s.isActive).sort((a, b) => a.startTime.localeCompare(b.startTime))
  const today = istDate(now)
  const out: SlotOption[] = []
  let open = 0

  for (let n = 0; n < daysAhead && open < wantOpen; n++) {
    const date = addDays(today, n)
    const dow = weekday(date)
    for (const s of active) {
      if (!s.daysOfWeek.includes(dow)) continue
      const cutoffAt = new Date(istInstant(date, s.startTime).getTime() - s.cutoffHours * 3_600_000)
      if (cutoffAt.getTime() <= now.getTime()) continue
      const key = slotKey(date, s.id)
      const booked = bookedCounts[key] ?? 0
      const full = booked >= s.maxOrders
      out.push({ slotId: s.id, date, key, cutoffAt, booked, left: Math.max(0, s.maxOrders - booked), full })
      if (!full) open++
      if (open >= wantOpen) break
    }
  }
  return out
}
