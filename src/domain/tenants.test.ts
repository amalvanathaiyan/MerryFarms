import { describe, expect, it } from "vitest"
import { checkSlug, isInvoicePrefix, statusLabel, suggestInvoicePrefix, suggestSlug, trialEnd } from "./tenants"

describe("farm subdomains", () => {
  it("accepts simple lowercase names", () => {
    expect(checkSlug("merryfarms")).toBeNull()
    expect(checkSlug("kaveri-dairy")).toBeNull()
    expect(checkSlug("farm2")).toBeNull()
  })
  it("refuses bad shapes and the platform's own names", () => {
    expect(checkSlug("ab")).toBe("slug_format")
    expect(checkSlug("Merry")).toBe("slug_format")
    expect(checkSlug("2farm")).toBe("slug_format")
    expect(checkSlug("farm-")).toBe("slug_format")
    expect(checkSlug("my--farm")).toBe("slug_format")
    expect(checkSlug("merry farms")).toBe("slug_format")
    expect(checkSlug("admin")).toBe("slug_reserved")
    expect(checkSlug("www")).toBe("slug_reserved")
  })
  it("suggests a subdomain from the English name", () => {
    expect(suggestSlug("Merry Farms")).toBe("merryfarms")
    expect(suggestSlug("Kaveri Dairy & Co.")).toBe("kaveridairyco")
    expect(suggestSlug("99 Acres Farm")).toBe("acresfarm")
    expect(suggestSlug("A")).toBe("")
  })
})

describe("bill prefix", () => {
  it("takes initials, or the first letters of a one-word name", () => {
    expect(suggestInvoicePrefix("Merry Farms")).toBe("MF")
    expect(suggestInvoicePrefix("Kaveri")).toBe("KAV")
    expect(suggestInvoicePrefix("Sri Murugan Organic Farms Pvt")).toBe("SMOF")
    expect(isInvoicePrefix("MF")).toBe(true)
    expect(isInvoicePrefix("M")).toBe(false)
    expect(isInvoicePrefix("mf")).toBe(false)
  })
})

describe("trials", () => {
  const now = new Date("2026-10-30T10:00:00Z")
  it("ends after the given days", () => {
    expect(trialEnd(now, 30).toISOString()).toBe("2026-11-29T10:00:00.000Z")
  })
  it("calls out a trial that has run out", () => {
    expect(statusLabel("trial", new Date("2026-10-01"), now)).toBe("trial_over")
    expect(statusLabel("trial", new Date("2026-11-30"), now)).toBe("trial")
    expect(statusLabel("active", new Date("2026-10-01"), now)).toBe("active")
    expect(statusLabel("suspended", null, now)).toBe("suspended")
  })
})
