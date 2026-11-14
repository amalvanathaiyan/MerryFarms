import { describe, expect, it } from "vitest"
import { serviceDue, toAcres, totalLandAcres } from "./farm-core"

const place = (id: string, kind: string, area: number | null, areaUnit = "acre", parentId: string | null = null, retiredAt: Date | null = null) => ({ id, kind, area, areaUnit, parentId, retiredAt })

describe("land", () => {
  it("converts units to acres", () => {
    expect(toAcres(50, "cent")).toBeCloseTo(0.5)
    expect(toAcres(1, "hectare")).toBeCloseTo(2.471, 3)
    expect(toAcres(43_560, "sqft")).toBeCloseTo(1)
  })
  it("adds up blocks and loose plots, never a block's plots twice", () => {
    const places = [place("b1", "block", 5), place("p1", "plot", 2, "acre", "b1"), place("p2", "plot", 50, "cent"), place("s", "shed", null), place("old", "block", 9, "acre", null, new Date())]
    expect(totalLandAcres(places)).toBe(5.5)
  })
})

describe("service", () => {
  const a = { serviceEveryDays: 90, lastServiceOn: "2026-08-20", boughtOn: "2025-01-01" }
  it("is due the set days after the last service", () => {
    expect(serviceDue(a, "2026-11-01")).toEqual({ on: "2026-11-18", state: "ok", days: 17 })
    expect(serviceDue(a, "2026-11-14")?.state).toBe("soon")
    expect(serviceDue(a, "2026-11-20")).toMatchObject({ state: "overdue", days: -2 })
  })
  it("counts from when it was bought if never serviced, and is nothing without a regular service", () => {
    expect(serviceDue({ ...a, lastServiceOn: null }, "2026-11-14")?.state).toBe("overdue")
    expect(serviceDue({ ...a, serviceEveryDays: null }, "2026-11-14")).toBeNull()
  })
})
