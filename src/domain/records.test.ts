import { describe, expect, it } from "vitest"
import { checkProduction, costInPeriod, costs, costsInPeriod, production, spreadEnd, productionStockDelta, productionTotals, profit } from "./records"
import { addDays, addMonths } from "./ist"

const day = (date: string, eggs: number | null, birds: number | null, over = {}) => ({ date, eggsCollected: eggs, eggsBroken: 0, birds, birdsLost: 0, feedKg: 6, ...over })

describe("production", () => {
  it("adds up eggs, laying rate, losses and feed over recorded days", () => {
    const p = production([day("2026-10-20", 70, 100, { eggsBroken: 2 }), day("2026-10-21", 80, 99, { birdsLost: 1 }), day("2026-10-22", null, 99, { feedKg: null })])
    expect(p).toMatchObject({ daysRecorded: 3, eggsCollected: 150, eggsBroken: 2, eggsPerDay: 74, birdsLost: 1, birdsNow: 99, feedKg: 12, feedKgPerDay: 6 })
    expect(p.layingRatePct).toBe(75.4) // 150 eggs / 199 bird-days
  })

  it("has no laying rate without bird counts, and copes with nothing recorded", () => {
    expect(production([day("2026-10-20", 70, null)]).layingRatePct).toBeNull()
    expect(production([])).toMatchObject({ daysRecorded: 0, eggsPerDay: 0, birdsNow: null, feedKgPerDay: 0 })
  })
})

describe("costs and profit", () => {
  it("total by kind and cost per good egg", () => {
    const c = costs(
      [
        { date: "2026-10-20", kind: "feed", amountPaise: 300_000 },
        { date: "2026-10-21", kind: "medicine", amountPaise: 50_000 },
        { date: "2026-10-21", kind: "feed", amountPaise: 150_000 },
      ],
      { eggsCollected: 1_000, eggsBroken: 100 }
    )
    expect(c.totalPaise).toBe(500_000)
    expect(c.byKind).toEqual([{ kind: "feed", paise: 450_000 }, { kind: "medicine", paise: 50_000 }])
    expect(c.feedPerEggPaise).toBe(500) // ₹5 of feed per good egg
    expect(c.costPerEggPaise).toBe(556)
    expect(costs([], { eggsCollected: 0, eggsBroken: 0 })).toMatchObject({ totalPaise: 0, feedPerEggPaise: null, costPerEggPaise: null })
  })

  it("profit is net sales minus spending", () => {
    expect(profit(1_000_000, 600_000)).toEqual({ profitPaise: 400_000, marginPct: 40 })
    expect(profit(0, 50_000)).toEqual({ profitPaise: -50_000, marginPct: null })
  })
})

describe("production for any farm", () => {
  it("moves stock only by the change in good quantity", () => {
    expect(productionStockDelta(null, { made: 40, wasted: 2 })).toBe(38)
    expect(productionStockDelta({ made: 40, wasted: 2 }, { made: 45, wasted: 2 })).toBe(5)
    expect(productionStockDelta({ made: 40, wasted: 2 }, { made: 40, wasted: 5 })).toBe(-3)
    expect(productionStockDelta({ made: 10, wasted: 0 }, { made: 0, wasted: 0 })).toBe(-10)
  })

  it("checks entries and totals per product", () => {
    expect(checkProduction({ made: 18.5, wasted: 0.5 })).toBeNull()
    expect(checkProduction({ made: 5, wasted: 6 })).toBe("wasted_more_than_made")
    expect(checkProduction({ made: -1, wasted: 0 })).toBe("record_invalid")
    expect(
      productionTotals([
        { productId: "milk", made: 18.5, wasted: 0.5 },
        { productId: "oil", made: 40, wasted: 2 },
        { productId: "milk", made: 19, wasted: 0 },
      ])
    ).toEqual([
      { productId: "oil", made: 40, wasted: 2, days: 1 },
      { productId: "milk", made: 37.5, wasted: 0.5, days: 2 },
    ])
  })
})

describe("big costs spread over time", () => {
  const shed = { date: "2026-01-01", kind: "infrastructure", amountPaise: 12_000_000, spreadMonths: 12 } // ₹1,20,000 over a year

  it("counts a one-off cost wholly on the day it was paid", () => {
    const oneOff = { ...shed, spreadMonths: null }
    expect(costInPeriod(oneOff, "2026-01-01", "2026-01-31")).toBe(12_000_000)
    expect(costInPeriod(oneOff, "2026-02-01", "2026-02-28")).toBe(0)
  })

  it("shares a spread cost out by day: about a twelfth a month, nothing outside the year", () => {
    expect(costInPeriod(shed, "2026-01-01", "2026-01-31")).toBe(Math.round((12_000_000 * 31) / 365))
    expect(costInPeriod(shed, "2025-12-01", "2025-12-31")).toBe(0)
    expect(costInPeriod(shed, "2027-01-01", "2027-01-31")).toBe(0)
  })

  it("adds up to exactly the amount paid over the whole spread, month by month", () => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const from = addMonths("2026-01-01", i)
      return costInPeriod(shed, from, addDays(addMonths(from, 1), -1))
    })
    expect(months.reduce((a, b) => a + b, 0)).toBe(12_000_000)
  })

  it("ends the day before the same date months later, also at month ends", () => {
    expect(spreadEnd("2026-01-01", 12)).toBe("2026-12-31")
    expect(spreadEnd("2026-01-31", 1)).toBe("2026-02-27")
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29")
  })

  it("keeps only the costs with a share in the period", () => {
    const rows = costsInPeriod([shed, { date: "2026-03-05", kind: "labour", amountPaise: 500_000, spreadMonths: null }], "2026-02-01", "2026-02-28")
    expect(rows.map((r) => r.kind)).toEqual(["infrastructure"])
  })
})
