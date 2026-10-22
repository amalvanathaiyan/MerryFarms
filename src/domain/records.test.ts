import { describe, expect, it } from "vitest"
import { checkDayRecord, costs, production, profit } from "./records"

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

describe("day entry checks", () => {
  it("refuse negatives, fractions and more broken than collected", () => {
    const ok = { eggsCollected: 70, eggsBroken: 2, birds: 100, birdsLost: 0, feedKg: 6.5 }
    expect(checkDayRecord(ok)).toBeNull()
    expect(checkDayRecord({ ...ok, eggsCollected: -1 })).toBe("record_invalid")
    expect(checkDayRecord({ ...ok, birds: 10.5 })).toBe("record_invalid")
    expect(checkDayRecord({ ...ok, eggsBroken: 80 })).toBe("broken_more_than_collected")
  })
})
