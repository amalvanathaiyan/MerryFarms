import { describe, expect, it } from "vitest"
import { cleanNameColours, colourName, openingMarkOf, showPlatformLine, taglineFor } from "./brand"

describe("colourName", () => {
  it("gives each word the next colour in turn", () => {
    expect(colourName("Merry Farms", ["#A8262B", "#1F6B3A"])).toEqual([
      { text: "Merry", colour: "#A8262B" },
      { text: " ", colour: null },
      { text: "Farms", colour: "#1F6B3A" },
    ])
  })

  it("works for Tamil names and cycles the colours", () => {
    const parts = colourName("மெர்ரி ஃபார்ம்ஸ் பண்ணை", ["#A8262B", "#1F6B3A"])
    expect(parts.filter((p) => p.colour).map((p) => p.colour)).toEqual(["#A8262B", "#1F6B3A", "#A8262B"])
  })

  it("leaves the name plain without colours", () => {
    expect(colourName("Green Acre", [])).toEqual([{ text: "Green Acre", colour: null }])
  })
})

describe("cleanNameColours", () => {
  it("accepts up to three hex colours", () => {
    expect(cleanNameColours(["#a8262b", " #1F6B3A "])).toEqual(["#A8262B", "#1F6B3A"])
    expect(cleanNameColours([])).toEqual([])
  })
  it("refuses anything else", () => {
    expect(cleanNameColours(["red"])).toBeNull()
    expect(cleanNameColours(["#fff"])).toBeNull()
    expect(cleanNameColours(["#111111", "#222222", "#333333", "#444444"])).toBeNull()
  })
})

describe("showPlatformLine", () => {
  it("shows the small FarmForYou line under every farm's tagline", () => {
    expect(showPlatformLine("Fresh eggs every morning")).toBe(true)
    expect(showPlatformLine(null)).toBe(true)
  })
  it("doesn't repeat it when the tagline already is Farm For You", () => {
    expect(showPlatformLine("Farm For You")).toBe(false)
    expect(showPlatformLine(" farm for you ")).toBe(false)
  })
})

describe("taglineFor", () => {
  const farm = { taglineTa: "தினமும் புதிய முட்டை", taglineEn: "Fresh eggs daily" }
  it("picks the reader's language, else the other", () => {
    expect(taglineFor("ta", farm)).toBe("தினமும் புதிய முட்டை")
    expect(taglineFor("en", farm)).toBe("Fresh eggs daily")
    expect(taglineFor("ta", { taglineTa: " ", taglineEn: "Farm For You" })).toBe("Farm For You")
    expect(taglineFor("en", { taglineTa: null, taglineEn: null })).toBeNull()
  })
})

describe("openingMarkOf", () => {
  it("knows only the platform's marks", () => {
    expect(openingMarkOf("merry-egg")).toBe("merry-egg")
    expect(openingMarkOf("anything")).toBeNull()
    expect(openingMarkOf(null)).toBeNull()
  })
})
