import { describe, expect, it } from "vitest"
import { consentChanges, isCustomerKind, isCustomerSource, sourceOfChannel, STAFF_SOURCES } from "./customers"

describe("customers", () => {
  it("names how an order's customer came", () => {
    expect(sourceOfChannel("web")).toBe("online")
    expect(sourceOfChannel("walk_in")).toBe("walk_in")
    expect(STAFF_SOURCES.every(isCustomerSource)).toBe(true)
    expect(isCustomerSource("ffy")).toBe(true)
    expect(isCustomerSource("tv")).toBe(false)
    expect(isCustomerKind("hotel")).toBe(true)
    expect(isCustomerKind("vip")).toBe(false)
  })
  it("logs only the offers that changed", () => {
    expect(consentChanges({ whatsapp: false, sms: false }, { whatsapp: false, sms: false })).toEqual([])
    expect(consentChanges({ whatsapp: false, sms: true }, { whatsapp: true, sms: false })).toEqual([
      { channel: "whatsapp", given: true },
      { channel: "sms", given: false },
    ])
  })
})
