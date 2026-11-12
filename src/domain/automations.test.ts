import { describe, expect, it } from "vitest"
import { cleanParams, resolveRecipe, waitedFor, waitLevel } from "./automations"

describe("resolveRecipe", () => {
  it("uses the recipe's defaults when nobody has set anything", () => {
    expect(resolveRecipe("orderWaiting", null, null)).toEqual({ enabled: true, params: { yellowHours: 2, redHours: 4 }, lockedOff: false })
  })

  it("the farm's numbers and switch win over the platform's", () => {
    const r = resolveRecipe("orderWaiting", { enabled: true, params: { yellowHours: 3 } }, { enabled: false, params: { redHours: 6 } })
    expect(r).toEqual({ enabled: false, params: { yellowHours: 3, redHours: 6 }, lockedOff: false })
  })

  it("the platform switching a recipe off switches it off for every farm", () => {
    const r = resolveRecipe("lowStock", { enabled: false, params: {} }, { enabled: true, params: {} })
    expect(r.enabled).toBe(false)
    expect(r.lockedOff).toBe(true)
  })

  it("keeps numbers within limits, and red never before yellow", () => {
    expect(cleanParams("orderWaiting", { yellowHours: 0, redHours: 1000, other: 5 })).toEqual({ yellowHours: 0.25, redHours: 96 })
    expect(resolveRecipe("orderWaiting", null, { enabled: true, params: { yellowHours: 5, redHours: 3 } }).params).toEqual({ yellowHours: 5, redHours: 5 })
  })

  it("platform recipes ignore farm settings", () => {
    expect(resolveRecipe("trialEnding", { enabled: true, params: { daysBefore: 5 } }, { enabled: false, params: { daysBefore: 9 } })).toEqual({ enabled: true, params: { daysBefore: 5 }, lockedOff: false })
  })
})

describe("waitLevel", () => {
  const placed = new Date("2026-11-12T08:00:00Z")
  const at = (h: number) => new Date(placed.getTime() + h * 3_600_000)
  it("goes green, yellow, red as the hours pass", () => {
    const p = { yellowHours: 2, redHours: 4 }
    expect(waitLevel(placed, at(1.9), p)).toBe("green")
    expect(waitLevel(placed, at(2), p)).toBe("yellow")
    expect(waitLevel(placed, at(4), p)).toBe("red")
  })
  it("says how long in hours and minutes", () => {
    expect(waitedFor(placed, at(2.25))).toEqual({ hours: 2, minutes: 15 })
    expect(waitedFor(placed, at(-1))).toEqual({ hours: 0, minutes: 0 })
  })
})
