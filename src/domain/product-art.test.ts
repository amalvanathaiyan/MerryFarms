import { describe, expect, it } from "vitest"
import { artFor, artKind, sniffImage, STARTER_CATEGORIES } from "./product-art"

describe("product placeholders", () => {
  it("picks eggs before chicken, in Tamil and English", () => {
    expect(artKind("நாட்டுக் கோழி முட்டை")).toBe("egg")
    expect(artKind("Country eggs")).toBe("egg")
    expect(artKind("Naatu kozhi, curry cut")).toBe("chicken")
    expect(artKind("நாட்டுக் கோழி, முழு")).toBe("chicken")
  })
  it("falls back to the category, then a basket", () => {
    expect(artKind("Gift box", "Eggs")).toBe("egg")
    expect(artKind("Gift box", null, "Others")).toBe("basket")
  })
})

describe("placeholders for any farm", () => {
  it("recognise dairy, oils, produce and value-added goods in Tamil and English", () => {
    const cases: [string, string][] = [
      ["நாட்டு மாட்டுப் பால்", "milk"], ["Cow milk", "milk"], ["பசு நெய்", "dairy"], ["Ghee", "dairy"], ["வெண்ணெய்", "dairy"],
      ["நல்லெண்ணெய்", "oil"], ["Groundnut oil (cold pressed)", "oil"], ["மலைத் தேன்", "honey"], ["கறிவேப்பிலை", "greens"],
      ["Palak keerai", "greens"], ["மஞ்சள் பொடி", "spices"], ["இட்லி பொடி", "pickles"], ["Mango pickle", "pickles"],
      ["கேழ்வரகு மாவு", "grains"], ["Mappillai samba rice", "grains"], ["மாம்பழம்", "fruits"], ["தக்காளி", "vegetables"],
      ["Country fish", "chicken"], ["Moringa saplings", "plants"], ["Soap", "basket"],
    ]
    for (const [name, kind] of cases) expect([name, artKind(name)]).toEqual([name, kind])
  })

  it("prefer the category's chosen type over guessing", () => {
    expect(artFor("oil", "Something new")).toBe("oil")
    expect(artFor("basket", "Country eggs")).toBe("egg")
    expect(artFor(null, "Paneer")).toBe("dairy")
    expect(artFor("not-a-kind", "Honey")).toBe("honey")
  })

  it("ready-made categories guess their own type from their names", () => {
    for (const c of STARTER_CATEGORIES) expect([c.nameEn, artKind(c.nameTa)]).toEqual([c.nameEn, c.kind])
  })
})

describe("photo checks", () => {
  it("recognises JPEG, PNG and WebP by content only", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp")
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull()
  })
})
