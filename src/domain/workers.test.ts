import { describe, expect, it } from "vitest"
import { earned, labourByPlace, owed } from "./workers"

const daily = { id: "a", payType: "daily", ratePaise: 50_000 }
const monthly = { id: "b", payType: "monthly", ratePaise: 1_200_000 }

describe("wages", () => {
  it("counts days worked, halves as half", () => {
    expect(earned(daily, [{ state: "present" }, { state: "half" }, { state: "absent" }])).toEqual({ days: 1.5, paise: 75_000 })
  })
  it("pays a month's rate as 30 days", () => {
    expect(earned(monthly, Array.from({ length: 30 }, () => ({ state: "present" }))).paise).toBe(1_200_000)
    expect(earned(monthly, [{ state: "present" }]).paise).toBe(40_000)
  })
  it("takes every wage and advance off what was earned", () => {
    expect(owed(150_000, [{ amountPaise: 50_000 }, { amountPaise: 20_000 }])).toBe(80_000)
    expect(owed(0, [{ amountPaise: 20_000 }])).toBe(-20_000)
  })
  it("puts each day's pay on where it was worked", () => {
    const m = labourByPlace([daily, monthly], [
      { workerId: "a", state: "present", placeId: "p1" },
      { workerId: "a", state: "half", placeId: null },
      { workerId: "b", state: "present", placeId: "p1" },
      { workerId: "x", state: "present", placeId: "p1" },
    ])
    expect(m.get("p1")).toBe(90_000)
    expect(m.get(null)).toBe(25_000)
  })
})
