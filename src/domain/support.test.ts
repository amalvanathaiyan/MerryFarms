import { describe, expect, it } from "vitest"
import { areaOf, kindOf, summarise, visitOpen } from "./support"

describe("support visits", () => {
  const at = new Date("2026-11-11T10:00:00Z")
  const v = { tenantId: "t1", endsAt: new Date("2026-11-11T11:00:00Z"), endedAt: null }

  it("is open only for its own farm, until it ends or its hour runs out", () => {
    expect(visitOpen(v, "t1", at)).toBe(true)
    expect(visitOpen(v, "t2", at)).toBe(false)
    expect(visitOpen(v, "t1", new Date("2026-11-11T11:00:00Z"))).toBe(false)
    expect(visitOpen({ ...v, endedAt: at }, "t1", at)).toBe(false)
  })

  it("puts each change in words a farm uses", () => {
    expect(areaOf("OrderItem")).toBe("orders")
    expect(areaOf("Payment")).toBe("money")
    expect(areaOf("BatchLoss")).toBe("poultry")
    expect(areaOf("Tenant")).toBe("settings")
    expect(areaOf("Something")).toBe("other")
    expect([kindOf("create"), kindOf("createMany"), kindOf("upsert"), kindOf("updateMany"), kindOf("deleteMany")]).toEqual(["added", "added", "changed", "changed", "removed"])
  })

  it("counts a visit's changes by area and kind", () => {
    expect(
      summarise([
        { model: "Order", operation: "update" },
        { model: "OrderItem", operation: "updateMany" },
        { model: "Product", operation: "create" },
      ])
    ).toEqual([
      { area: "orders", kind: "changed", count: 2 },
      { area: "products", kind: "added", count: 1 },
    ])
  })
})
