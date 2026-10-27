import { describe, expect, it } from "vitest"
import { cannotEnable, FEATURES, parseChoices, planAllows, resolveFeatures } from "./features"

describe("feature switches", () => {
  it("turns on the defaults a new free farm gets", () => {
    const f = resolveFeatures("free", {})
    expect(f).toMatchObject({ webShop: true, callConfirmation: true, stockTracking: true, creditAccounts: true, invoices: true })
    expect(f.subscriptions).toBe(false)
  })

  it("lets the farm switch off what it doesn't need", () => {
    const f = resolveFeatures("free", { stockTracking: false, creditAccounts: false })
    expect(f.stockTracking).toBe(false)
    expect(f.creditAccounts).toBe(false)
    expect(f.invoices).toBe(true)
  })

  it("never turns on a feature the plan doesn't include, even if the farm chose it", () => {
    expect(planAllows("free", "subscriptions")).toBe(false)
    expect(planAllows("growth", "subscriptions")).toBe(true)
    expect(planAllows("pro", "subscriptions")).toBe(true)
  })

  it("keeps unbuilt features off and says why", () => {
    expect(resolveFeatures("pro", { subscriptions: true }).subscriptions).toBe(FEATURES.subscriptions.available)
    expect(cannotEnable("pro", "subscriptions")).toBe(FEATURES.subscriptions.available ? null : "coming_soon")
    expect(cannotEnable("free", "webShop")).toBeNull()
  })

  it("switches off a feature whose requirement is off", () => {
    // broadcasts needs automated WhatsApp
    const f = resolveFeatures("pro", { broadcasts: true, whatsappCloud: false })
    expect(f.broadcasts).toBe(false)
  })

  it("reads saved choices defensively", () => {
    expect(parseChoices({ webShop: false, bogus: true, invoices: "yes" })).toEqual({ webShop: false })
    expect(parseChoices(null)).toEqual({})
    expect(parseChoices([true])).toEqual({})
  })
})
