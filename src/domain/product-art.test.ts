import { describe, expect, it } from "vitest"
import { artKind, sniffImage } from "./product-art"

describe("product placeholders", () => {
  it("picks eggs before chicken, in Tamil and English", () => {
    expect(artKind("நாட்டுக் கோழி முட்டை")).toBe("egg")
    expect(artKind("Country eggs")).toBe("egg")
    expect(artKind("Naatu kozhi, curry cut")).toBe("chicken")
    expect(artKind("நாட்டுக் கோழி, முழு")).toBe("chicken")
  })
  it("falls back to the category, then a basket", () => {
    expect(artKind("Ghee", "Eggs")).toBe("egg")
    expect(artKind("Honey", null, "Others")).toBe("basket")
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
