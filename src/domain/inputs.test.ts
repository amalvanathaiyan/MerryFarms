import { describe, expect, it } from "vitest"
import { countChange, expenseKindFor, inputStock, isLow, worth } from "./inputs"
import { feedStore } from "./batches"

describe("the store", () => {
  it("works out what's left and the average price", () => {
    const s = inputStock(
      [
        { quantity: 50, amountPaise: 150_000 },
        { quantity: 50, amountPaise: 170_000 },
        { quantity: null, amountPaise: 9_999 },
      ],
      [
        { kind: "used", quantity: 30 },
        { kind: "count", quantity: -2.5 },
      ]
    )
    expect(s).toEqual({ bought: 100, used: 30, counted: -2.5, left: 67.5, pricePaise: 3_200 })
  })
  it("takes the batches' feed out of the hens' feed", () => {
    expect(inputStock([{ quantity: 100, amountPaise: 300_000 }], [], 40).left).toBe(60)
  })
  it("has no price until something is bought with its quantity", () => {
    expect(inputStock([], [{ kind: "count", quantity: 10 }])).toMatchObject({ left: 10, pricePaise: null })
  })
  it("saves a count as the change from the book", () => {
    expect(countChange(67.5, 60)).toBe(-7.5)
    expect(countChange(0, 12)).toBe(12)
  })
  it("warns only at or below the item's level", () => {
    expect(isLow(5, 5)).toBe(true)
    expect(isLow(5.1, 5)).toBe(false)
    expect(isLow(-1, null)).toBe(false)
  })
  it("prices what was used", () => {
    expect(worth(2.5, 3_200)).toBe(8_000)
    expect(worth(2, null)).toBeNull()
  })
  it("buys each kind as its spending kind in Money", () => {
    expect(["feed", "seed", "fertiliser", "medicine", "packing", "other"].map(expenseKindFor)).toEqual(["feed", "seeds", "seeds", "medicine", "packing", "raw_materials"])
  })
  it("keeps the hens' feed store as before, with the store's other uses and counts", () => {
    const buys = [{ quantityKg: 100, amountPaise: 300_000 }]
    expect(feedStore(buys, 40)).toEqual({ boughtKg: 100, usedKg: 40, leftKg: 60, pricePerKgPaise: 3_000 })
    // 5 kg used elsewhere, a count found 2 kg more: 3 kg less left; given and price unchanged
    expect(feedStore(buys, 40, 3)).toEqual({ boughtKg: 100, usedKg: 40, leftKg: 57, pricePerKgPaise: 3_000 })
  })
})
