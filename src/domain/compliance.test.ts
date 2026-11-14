import { describe, expect, it } from "vitest"
import { cleanConfig, matchEntry, screen, splitWords, STARTER_ITEMS } from "./compliance"

const peafowl = { id: "p", wordsTa: ["மயில்"], wordsEn: ["peacock", "peafowl"], action: "block" }
const honey = { id: "h", wordsTa: ["தேன்"], wordsEn: ["honey"], action: "licence" }
const fish = { id: "f", wordsTa: [], wordsEn: ["thai magur"], action: "hold" }

describe("matching a farm's words", () => {
  it("finds whole English words and their plurals, not parts of other words", () => {
    expect(matchEntry("Peacock feathers", peafowl)).toBe("peacock")
    expect(matchEntry("Two PEACOCKS", peafowl)).toBe("peacock")
    expect(matchEntry("Peacockery", peafowl)).toBeNull()
    expect(matchEntry("Fresh  Thai   Magur fish", fish)).toBe("thai magur")
  })
  it("finds Tamil words with endings joined on", () => {
    expect(matchEntry("மயில்கள் விற்பனை", peafowl)).toBe("மயில்")
    expect(matchEntry("நாட்டுக்கோழி முட்டை", peafowl)).toBeNull()
  })
})

describe("screening", () => {
  it("returns the most serious match", () => {
    expect(screen(["Honey", "with peacock feather"], [honey, peafowl], { hasLicence: false })).toEqual({ itemId: "p", word: "peacock", action: "block" })
    expect(screen(["Country eggs", null], [honey, peafowl], { hasLicence: false })).toBeNull()
  })
  it("lets licensed items through once the licence is on file", () => {
    expect(screen(["Hill honey"], [honey], { hasLicence: false })?.action).toBe("licence")
    expect(screen(["Hill honey"], [honey], { hasLicence: true })).toBeNull()
  })
  it("doesn't flag everyday farm products with the starter list", () => {
    const list = STARTER_ITEMS.map((s, i) => ({ ...s, id: String(i) }))
    for (const p of ["நாட்டுக்கோழி முட்டைகள்", "Country chicken eggs", "காடை முட்டை", "Quail eggs", "தேங்காய்", "கத்தரிக்காய்கள்", "Desi cow milk", "பசும்பால்", "Goat meat", "Rohu fish"]) {
      expect(screen([p], list, { hasLicence: false }), p).toBeNull()
    }
  })
})

describe("admin's input", () => {
  it("splits words and checks the switch", () => {
    expect(splitWords("peacock, peahen,\n peacock , x")).toEqual(["peacock", "peahen"])
    expect(cleanConfig(null)).toEqual({ on: false, repeatLimit: 3 })
    expect(cleanConfig({ on: true, repeatLimit: 99 })).toEqual({ on: true, repeatLimit: 3 })
  })
})
