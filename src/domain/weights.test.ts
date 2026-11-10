import { describe, expect, it } from "vitest"
import { avgGrams, checkWeight, weighDue, weightPoints, weightText } from "./weights"

// Came 1 Oct at 7 days old, so hatched 24 Sep.
const b = { startDate: "2026-10-01", ageAtStartDays: 7, closedDate: null as string | null }

describe("a weighing", () => {
  it("averages the birds weighed", () => {
    expect(avgGrams({ birds: 10, totalGrams: 8505 })).toBe(851)
    expect(avgGrams({ birds: 0, totalGrams: 100 })).toBe(0)
  })

  it("follows growth: age at each weighing and grams a day since the one before", () => {
    const pts = weightPoints(b, [
      { date: "2026-10-15", birds: 10, totalGrams: 9000 },
      { date: "2026-10-01", birds: 10, totalGrams: 1800 },
      { date: "2026-10-08", birds: 10, totalGrams: 4600 },
    ])
    expect(pts.map((p) => [p.date, p.ageDays, p.avgGrams, p.gainPerDay])).toEqual([
      ["2026-10-01", 7, 180, null],
      ["2026-10-08", 14, 460, 40],
      ["2026-10-15", 21, 900, 63],
    ])
  })

  it("is due when never weighed, or a week after the last weighing, while the batch is on the farm", () => {
    expect(weighDue(b, [], "2026-10-02")).toEqual({ due: true, daysSince: null })
    expect(weighDue(b, [{ date: "2026-10-08", birds: 5, totalGrams: 2000 }], "2026-10-14")).toEqual({ due: false, daysSince: 6 })
    expect(weighDue(b, [{ date: "2026-10-08", birds: 5, totalGrams: 2000 }], "2026-10-15")).toEqual({ due: true, daysSince: 7 })
    expect(weighDue({ ...b, closedDate: "2026-10-20" }, [], "2026-10-25").due).toBe(false)
    expect(weighDue(b, [], "2026-09-30").due).toBe(false)
  })

  it("refuses a day outside the batch's time on the farm, too many birds, or a weight that must be a slip", () => {
    const ok = { date: "2026-10-08", birds: 10, totalGrams: 4600 }
    expect(checkWeight(b, ok, "2026-10-10")).toBeNull()
    expect(checkWeight(b, { ...ok, date: "2026-09-30" }, "2026-10-10")).toBe("weight_date")
    expect(checkWeight(b, { ...ok, date: "2026-10-11" }, "2026-10-10")).toBe("weight_date")
    expect(checkWeight({ ...b, closedDate: "2026-10-05" }, ok, "2026-10-10")).toBe("weight_date")
    expect(checkWeight(b, { ...ok, birds: 0 }, "2026-10-10")).toBe("weight_birds")
    expect(checkWeight(b, { ...ok, birds: 501 }, "2026-10-10")).toBe("weight_birds")
    expect(checkWeight(b, { ...ok, totalGrams: 0 }, "2026-10-10")).toBe("weight_total")
    // 10 birds "4.6 grams" each: kilos typed as grams.
    expect(checkWeight(b, { ...ok, totalGrams: 46 }, "2026-10-10")).toBe("weight_odd")
    expect(checkWeight(b, { ...ok, totalGrams: 4_600_000 }, "2026-10-10")).toBe("weight_odd")
  })

  it("shows grams under a kilo and kilos from a kilo up", () => {
    expect(weightText(851)).toEqual({ value: "851", unit: "g" })
    expect(weightText(1250)).toEqual({ value: "1.25", unit: "kg" })
    expect(weightText(2000)).toEqual({ value: "2", unit: "kg" })
    expect(weightText(1300)).toEqual({ value: "1.3", unit: "kg" })
    expect(weightText(1305)).toEqual({ value: "1.31", unit: "kg" })
  })
})
