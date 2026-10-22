import { describe, expect, it } from "vitest"
import { adjustPrice, currentPrice, offerActive, percentOff, validAgreedPrice } from "./offers"

const tray = { pricePaise: 39_000, offerPricePaise: 36_000, offerEndsOn: "2026-10-25" }

describe("offer prices", () => {
  it("apply up to and including the end day, then the list price returns", () => {
    expect(currentPrice(tray, "2026-10-22")).toBe(36_000)
    expect(currentPrice(tray, "2026-10-25")).toBe(36_000)
    expect(currentPrice(tray, "2026-10-26")).toBe(39_000)
    expect(offerActive({ ...tray, offerEndsOn: null }, "2030-01-01")).toBe(true)
  })

  it("ignore an 'offer' that isn't cheaper, or is missing", () => {
    expect(currentPrice({ ...tray, offerPricePaise: 39_000 }, "2026-10-22")).toBe(39_000)
    expect(currentPrice({ ...tray, offerPricePaise: 45_000 }, "2026-10-22")).toBe(39_000)
    expect(currentPrice({ ...tray, offerPricePaise: null }, "2026-10-22")).toBe(39_000)
  })

  it("show a whole-number percent off", () => {
    expect(percentOff(tray)).toBe(8)
    expect(percentOff({ ...tray, offerPricePaise: null })).toBe(0)
  })
})

describe("bulk price changes", () => {
  it("round to the rupee and never go below ₹1", () => {
    expect(adjustPrice(39_000, { mode: "pct", direction: "up", amount: 5 })).toBe(41_000) // 409.5 → 410
    expect(adjustPrice(16_800, { mode: "pct", direction: "down", amount: 10 })).toBe(15_100) // 151.2 → 151
    expect(adjustPrice(68_000, { mode: "rupees", direction: "up", amount: 20 })).toBe(70_000)
    expect(adjustPrice(500, { mode: "rupees", direction: "down", amount: 50 })).toBe(100)
  })
})

describe("prices agreed by staff", () => {
  it("may be a discount, never above the list price or below ₹1", () => {
    expect(validAgreedPrice(35_000, 39_000)).toBe(true)
    expect(validAgreedPrice(39_000, 39_000)).toBe(true)
    expect(validAgreedPrice(40_000, 39_000)).toBe(false)
    expect(validAgreedPrice(50, 39_000)).toBe(false)
    expect(validAgreedPrice(350.5, 39_000)).toBe(false)
  })
})
