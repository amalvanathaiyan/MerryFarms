import { describe, expect, it } from "vitest"
import { checkDose, checkScheduleItem, doseState, dosesDue, dueDateFor, planFor } from "./vaccinations"

// Bought at 3 days old, came 1 Oct, so hatched 28 Sep.
const B = { id: "b1", startDate: "2026-10-01", ageAtStartDays: 3, closedDate: null as string | null, startCount: 100 }
const schedule = [
  { vaccine: "Gumboro", ageDays: 14, method: "water" },
  { vaccine: "Marek", ageDays: 1, method: "injection" },
  { vaccine: "Lasota", ageDays: 7, method: "eye_drop" },
]

describe("planning doses", () => {
  it("dates a dose from the hatch day", () => {
    expect(dueDateFor(B, 7)).toBe("2026-10-05")
    expect(dueDateFor({ startDate: "2026-10-01", ageAtStartDays: 0 }, 0)).toBe("2026-10-01")
  })

  it("plans only the doses at or after the age the birds came at, earliest first", () => {
    expect(planFor(B, schedule)).toEqual([
      { vaccine: "Lasota", method: "eye_drop", dueDate: "2026-10-05" },
      { vaccine: "Gumboro", method: "water", dueDate: "2026-10-12" },
    ])
  })

  it("plans every dose for birds hatched here", () => {
    expect(planFor({ startDate: "2026-10-01", ageAtStartDays: 0 }, schedule).map((p) => p.vaccine)).toEqual(["Marek", "Lasota", "Gumboro"])
  })
})

describe("dose state", () => {
  const today = "2026-10-10"
  it("tells given, overdue, today, soon, later and unplanned apart", () => {
    expect(doseState({ dueDate: "2026-10-05", givenDate: "2026-10-06" }, today)).toBe("given")
    expect(doseState({ dueDate: "2026-10-09", givenDate: null }, today)).toBe("overdue")
    expect(doseState({ dueDate: today, givenDate: null }, today)).toBe("today")
    expect(doseState({ dueDate: "2026-10-13", givenDate: null }, today)).toBe("soon")
    expect(doseState({ dueDate: "2026-10-14", givenDate: null }, today)).toBe("later")
    expect(doseState({ dueDate: null, givenDate: null }, today)).toBe("unplanned")
  })
})

describe("doses due", () => {
  const v = (id: string, batchId: string, dueDate: string | null, givenDate: string | null = null) => ({ id, batchId, vaccine: id, dueDate, givenDate })
  it("lists doses due today or late for batches still on the farm, most late first", () => {
    const batches = [B, { id: "b2", startDate: "2026-09-01", closedDate: "2026-10-01" }]
    const due = dosesDue([v("a", "b1", "2026-10-10"), v("b", "b1", "2026-10-07"), v("c", "b1", "2026-10-11"), v("d", "b1", "2026-10-01", "2026-10-02"), v("e", "b2", "2026-09-20")], batches, "2026-10-10")
    expect(due.map((d) => [d.id, d.daysLate])).toEqual([
      ["b", 3],
      ["a", 0],
    ])
  })
})

describe("checks", () => {
  const dose = { vaccine: "Lasota", method: "eye_drop", dueDate: "2026-10-05", givenDate: null, birds: null, costPaise: null }
  it("accepts a planned dose and a given one", () => {
    expect(checkDose(B, dose, "2026-10-10")).toBeNull()
    expect(checkDose(B, { ...dose, givenDate: "2026-10-06", birds: 98, costPaise: 25000 }, "2026-10-10")).toBeNull()
  })

  it("refuses doses without a name or a day, or on impossible days", () => {
    expect(checkDose(B, { ...dose, vaccine: " " }, "2026-10-10")).toBe("vaccine_name_required")
    expect(checkDose(B, { ...dose, dueDate: null }, "2026-10-10")).toBe("vaccine_day_required")
    expect(checkDose(B, { ...dose, givenDate: "2026-10-11" }, "2026-10-10")).toBe("record_future")
    expect(checkDose(B, { ...dose, givenDate: "2026-09-30" }, "2026-10-10")).toBe("batch_before_start")
    expect(checkDose({ ...B, closedDate: "2026-10-08" }, { ...dose, givenDate: "2026-10-09" }, "2026-10-10")).toBe("batch_closed")
    expect(checkDose(B, { ...dose, givenDate: "2026-10-06", birds: 101 }, "2026-10-10")).toBe("vaccine_birds_invalid")
    expect(checkDose(B, { ...dose, method: "pill" }, "2026-10-10")).toBe("record_invalid")
  })

  it("checks schedule lines", () => {
    expect(checkScheduleItem({ vaccine: "Lasota", ageDays: 7, method: null })).toBeNull()
    expect(checkScheduleItem({ vaccine: "", ageDays: 7, method: null })).toBe("vaccine_name_required")
    expect(checkScheduleItem({ vaccine: "Lasota", ageDays: -1, method: null })).toBe("batch_age_invalid")
  })
})
