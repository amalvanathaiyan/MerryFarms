import { describe, expect, it } from "vitest"
import { firstSize, groupSizes, sizeFamily } from "./sizes"

const p = (id: string, categoryId: string, nameEn: string, stockQty = 5, nameTa = "முட்டை") => ({ id, categoryId, nameTa, nameEn, stockQty })

describe("sizes of one product", () => {
  it("groups products of one category with the same names, whatever the spacing or case", () => {
    expect(sizeFamily(p("a", "c1", "Country eggs"))).toBe(sizeFamily(p("b", "c1", "  country  EGGS ")))
    expect(sizeFamily(p("a", "c1", "Country eggs"))).not.toBe(sizeFamily(p("b", "c2", "Country eggs")))
    expect(sizeFamily(p("a", "c1", "Country eggs"))).not.toBe(sizeFamily(p("b", "c1", "Country eggs", 5, "வாத்து முட்டை")))
  })

  it("keeps the farm's order: each family where its first size comes, sizes in order", () => {
    const groups = groupSizes([p("6", "c1", "Country eggs"), p("milk", "c2", "Milk"), p("30", "c1", "Country eggs"), p("12", "c1", "country eggs")], sizeFamily)
    expect(groups.map((g) => g.sizes.map((s) => s.id))).toEqual([["6", "30", "12"], ["milk"]])
  })

  it("shows first the first size still in stock", () => {
    const sizes = [p("6", "c1", "E", 0), p("30", "c1", "E", 3)]
    expect(firstSize(sizes, true).id).toBe("30")
    expect(firstSize(sizes, false).id).toBe("6")
    expect(firstSize([p("6", "c1", "E", 0)], true).id).toBe("6")
  })
})
