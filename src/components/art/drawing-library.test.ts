import { describe, expect, it } from "vitest"
import { DRAWINGS, DRAWING_GROUPS, MAX_SHOP_ART, defaultShopArt, shopArt } from "./drawing-library"
import { ART_KINDS } from "@/domain/product-art"

describe("drawings library", () => {
  it("has the village set plus a group for every product type, with unique ids", () => {
    expect(DRAWING_GROUPS.map((g) => g.key).sort()).toEqual(["village", ...ART_KINDS].sort())
    const ids = DRAWING_GROUPS.flatMap((g) => g.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(DRAWINGS.size).toBe(137)
  })

  it("defaults to the village basics and two drawings per product type the farm sells", () => {
    expect(defaultShopArt(["egg", "chicken"])).toEqual(["cart", "coconut", "paddy", "sun", "eggBasket", "eggTray", "hen", "rooster"])
    expect(defaultShopArt([])).toEqual(["cart", "coconut", "paddy", "sun"])
    expect(defaultShopArt([...ART_KINDS]).length).toBe(MAX_SHOP_ART)
  })

  it("uses the owner's pick, ignoring unknown ids, and falls back to the default when nothing is left", () => {
    expect(shopArt(["cow", "nope", "milkCan"], ["egg"]).map((d) => d.id)).toEqual(["cow", "milkCan"])
    expect(shopArt(["nope"], ["honey"]).map((d) => d.id)).toEqual(["cart", "coconut", "paddy", "sun", "skep", "bee"])
  })
})
