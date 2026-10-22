import { describe, expect, it } from "vitest"
import { nextPlanDates, planDayCheck, planUnitPrice, validatePlan, type PlanRule } from "./plans"

// 2026-10-25 is a Sunday.
const weeklyEggs: PlanRule = { status: "active", startDate: "2026-10-20", pausedUntil: null, skipDates: [], daysOfWeek: [0] }
const everyDay = { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: true }

describe("plans", () => {
  it("runs on its days once started", () => {
    expect(planDayCheck(weeklyEggs, everyDay, "2026-10-25")).toBeNull()
    expect(planDayCheck(weeklyEggs, everyDay, "2026-10-26")).toBe("not_a_plan_day")
    expect(planDayCheck({ ...weeklyEggs, startDate: "2026-11-01" }, everyDay, "2026-10-25")).toBe("not_started")
  })

  it("respects pauses, skipped days and cancellation", () => {
    expect(planDayCheck({ ...weeklyEggs, pausedUntil: "2026-10-31" }, everyDay, "2026-10-25")).toBe("paused")
    expect(planDayCheck({ ...weeklyEggs, pausedUntil: "2026-10-31" }, everyDay, "2026-11-01")).toBeNull() // resumes after
    expect(planDayCheck({ ...weeklyEggs, status: "paused" }, everyDay, "2026-10-25")).toBe("paused") // paused with no end date
    expect(planDayCheck({ ...weeklyEggs, skipDates: ["2026-10-25"] }, everyDay, "2026-10-25")).toBe("skipped")
    expect(planDayCheck({ ...weeklyEggs, status: "cancelled" }, everyDay, "2026-10-25")).toBe("not_active")
  })

  it("doesn't run when its delivery slot doesn't run that day", () => {
    expect(planDayCheck(weeklyEggs, { daysOfWeek: [1, 2, 3, 4, 5, 6], isActive: true }, "2026-10-25")).toBe("slot_not_running")
    expect(planDayCheck(weeklyEggs, { ...everyDay, isActive: false }, "2026-10-25")).toBe("slot_not_running")
  })

  it("lists the next delivery dates", () => {
    expect(nextPlanDates({ ...weeklyEggs, skipDates: ["2026-11-01"] }, everyDay, "2026-10-21")).toEqual(["2026-10-25", "2026-11-08", "2026-11-15"])
  })

  it("prices plan items with the discount, rounded to the rupee", () => {
    expect(planUnitPrice(39_000, 0)).toBe(39_000)
    expect(planUnitPrice(39_000, 5)).toBe(37_100) // ₹370.50 → ₹371
    expect(planUnitPrice(9_000, 5)).toBe(8_600) // ₹85.50 → ₹86
  })

  it("validates a plan", () => {
    expect(validatePlan({ daysOfWeek: [0], items: [{ qty: 1 }], discountPct: 5 })).toBeNull()
    expect(validatePlan({ daysOfWeek: [], items: [{ qty: 1 }], discountPct: 0 })).toBe("plan_no_days")
    expect(validatePlan({ daysOfWeek: [0], items: [], discountPct: 0 })).toBe("plan_no_items")
    expect(validatePlan({ daysOfWeek: [0], items: [{ qty: 1 }], discountPct: 60 })).toBe("plan_bad_discount")
  })
})
