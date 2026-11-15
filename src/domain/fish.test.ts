import { describe, expect, it } from "vitest"
import { isFishSpecies, latestAverage, pondStock, pondWeight, speciesMix, waterReadingOk, waterWarnings } from "./fish"

const stockings = [
  { species: "rohu", count: 2000, sizeGrams: 10 },
  { species: "catla", count: 1000, sizeGrams: 10 },
  { species: "rohu", count: 500, sizeGrams: null },
]

describe("fishery", () => {
  it("counts what's in the pond", () => {
    expect(pondStock(stockings, [{ dead: 30 }, { dead: 20 }], 400)).toEqual({ stocked: 3500, dead: 50, harvested: 400, left: 3050, survivalPct: 98.6 })
    expect(pondStock([], [])).toMatchObject({ left: 0, survivalPct: null })
    expect(speciesMix(stockings)).toEqual([
      { species: "rohu", count: 2500 },
      { species: "catla", count: 1000 },
    ])
    expect(isFishSpecies("catla")).toBe(true)
    expect(isFishSpecies("thai_magur")).toBe(false)
  })

  it("takes the size from the latest sample day, and works out the pond's weight and feed per kg", () => {
    const samples = [
      { date: "2026-10-01", species: null, count: 10, totalGrams: 1000 },
      { date: "2026-11-01", species: "rohu", count: 10, totalGrams: 2500 },
      { date: "2026-11-01", species: "catla", count: 5, totalGrams: 2000 },
      { date: "2026-11-05", species: null, count: 0, totalGrams: 0 },
    ]
    expect(latestAverage(samples)).toEqual({ date: "2026-11-01", grams: 300 })
    expect(latestAverage([])).toBeNull()
    // 3,000 fish × 300 g = 900 kg; put in 2,500 × 10 g + 500 × ? = 30 kg; 1,300 kg feed for 870 kg gain
    const w = pondWeight(3000, { grams: 300 }, stockings, 1300)
    expect(w).toEqual({ kg: 900, fcr: 1.49 })
    expect(pondWeight(3000, null, stockings, 1300)).toBeNull()
    expect(pondWeight(3000, { grams: 300 }, stockings, 0)).toEqual({ kg: 900, fcr: null })
  })

  it("warns about water outside the safe range, worst first", () => {
    expect(waterWarnings({ ph: 7.5, oxygen: 6, tempC: 29, ammonia: 0.1 })).toEqual([])
    expect(waterWarnings({ ph: 8.8, oxygen: 2.5, tempC: null })).toEqual([
      { check: "oxygen", value: 2.5, side: "low", danger: true },
      { check: "ph", value: 8.8, side: "high", danger: false },
    ])
    expect(waterWarnings({ ammonia: 0.7, tempC: 36 }).map((w) => [w.check, w.danger])).toEqual([
      ["tempC", true],
      ["ammonia", false],
    ])
    expect(waterReadingOk("ph", 75)).toBe(false)
    expect(waterReadingOk("oxygen", 5.2)).toBe(true)
  })
})
