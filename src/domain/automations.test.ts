import { describe, expect, it } from "vitest"
import { waitedFor, waitLevel, waitMarks } from "./automations"

describe("waitMarks", () => {
  it("red never comes before yellow", () => {
    expect(waitMarks(2, 4)).toEqual({ yellowHours: 2, redHours: 4 })
    expect(waitMarks(5, 3)).toEqual({ yellowHours: 5, redHours: 5 })
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
