import { describe, expect, it } from "vitest"
import { atLimit, computeEntitlement, parseEntitlement } from "./entitlements"
import { cannotEnable, resolveFeatures } from "./features"

const plan = { id: "p1", modules: ["selling"], features: { subscriptions: "on", poultryCare: "on", nonsense: "on" }, limits: { products: 50, staff: -1, oops: 3 } }
const sub = { status: "active" as const, addOns: [] as string[], moduleOverrides: {} }

describe("computeEntitlement", () => {
  it("gives Farm Core plus the plan's modules, its feature rules and its limits", () => {
    const e = computeEntitlement(plan, sub)
    expect(e.modules.sort()).toEqual(["core", "selling"])
    expect(e.features).toEqual({ subscriptions: "on", poultryCare: "on" })
    expect(e.limits).toEqual({ products: 50 })
  })

  it("adds add-ons and admin's overrides, but never modules that aren't built or are switched off platform-wide", () => {
    const e = computeEntitlement(plan, { ...sub, addOns: ["poultry", "fishery"], moduleOverrides: { selling: false, crops: true, core: false } })
    expect(e.modules.sort()).toEqual(["core", "poultry"])
    expect(computeEntitlement(plan, { ...sub, addOns: ["poultry"] }, ["poultry"]).modules).not.toContain("poultry")
  })

  it("keeps only Farm Core while paused or ended", () => {
    expect(computeEntitlement(plan, { ...sub, status: "paused", addOns: ["poultry"] }).modules).toEqual(["core"])
    expect(computeEntitlement(plan, { ...sub, status: "ended" }).modules).toEqual(["core"])
  })
})

describe("features from an entitlement", () => {
  const e = computeEntitlement(plan, sub)

  it("turns on only features of the farm's modules; forced ones stay on whatever the farm chose", () => {
    const f = resolveFeatures(e, { subscriptions: false, webShop: false })
    expect(f.subscriptions).toBe(true) // forced on by the plan
    expect(f.webShop).toBe(false) // the farm's choice
    expect(f.invoices).toBe(true) // selling, default on
    expect(f.poultryCare).toBe(false) // forced on, but its module (poultry) isn't in the plan
    expect(f.farmRecords).toBe(true) // Farm Core, always
  })

  it("says why a feature can't be changed", () => {
    expect(cannotEnable(e, "poultryCare")).toBe("plan")
    expect(cannotEnable(e, "subscriptions")).toBe("forced")
    expect(cannotEnable(e, "webShop")).toBeNull()
  })

  it("still reads the old plan levels for farms not yet on an admin-made plan", () => {
    expect(resolveFeatures("free", {}).subscriptions).toBe(false)
    expect(cannotEnable("free", "subscriptions")).toBe("plan")
  })
})

describe("parseEntitlement and limits", () => {
  it("reads a saved entitlement defensively", () => {
    expect(parseEntitlement(null)).toBeNull()
    expect(parseEntitlement({ modules: "x" })).toBeNull()
    const e = parseEntitlement({ planId: "p1", modules: ["selling", "bogus"], features: { webShop: "maybe" }, limits: { staff: 2 }, status: "weird" })!
    expect(e.modules).toEqual(["core", "selling"])
    expect(e.features).toEqual({})
    expect(e.status).toBe("active")
  })

  it("knows when a limit is reached", () => {
    expect(atLimit({ products: 3 }, "products", 3)).toBe(true)
    expect(atLimit({ products: 3 }, "products", 2)).toBe(false)
    expect(atLimit({}, "products", 999)).toBe(false)
  })
})
