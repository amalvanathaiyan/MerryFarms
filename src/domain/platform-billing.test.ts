import { describe, expect, it } from "vitest"
import { announcementFor, announcementState, cleanProfile, DEFAULT_PROFILE, draftLines, invoiceAmounts, invoiceNumber, invoiceNumberPrefix, invoiceState } from "./platform-billing"

const TN = "33ABCDE1234F1Z5"
const KA = "29ABCDE1234F1Z5"
const lines = [{ text: "Plan", amountPaise: 99_900 }]

describe("billing profile", () => {
  it("falls back to the defaults", () => {
    expect(cleanProfile(null)).toEqual(DEFAULT_PROFILE)
    expect(cleanProfile({ dueDays: 500, gstRatePct: 7, sac: "x" })).toMatchObject({ dueDays: 7, gstRatePct: 18, sac: "998314" })
  })
  it("keeps GST off without a valid GSTIN", () => {
    expect(cleanProfile({ gstOn: true, gstin: "123" }).gstOn).toBe(false)
    expect(cleanProfile({ gstOn: true, gstin: TN.toLowerCase() })).toMatchObject({ gstOn: true, gstin: TN })
  })
})

describe("invoice amounts", () => {
  it("adds no tax while GST is off", () => {
    expect(invoiceAmounts(lines, { gstOn: false, gstin: TN, gstRatePct: 18 }, {})).toEqual({ subtotalPaise: 99_900, gstRatePct: 0, gstKind: "none", gstPaise: 0, totalPaise: 99_900 })
  })
  it("splits CGST + SGST in the same state, evenly", () => {
    const a = invoiceAmounts(lines, { gstOn: true, gstin: TN, gstRatePct: 18 }, { gstin: TN })
    expect(a.gstKind).toBe("cgst_sgst")
    expect(a.gstPaise % 2).toBe(0)
    expect(a.gstPaise).toBe(17_982)
    expect(a.totalPaise).toBe(117_882)
  })
  it("uses IGST for another state, from the farm's GSTIN or admin's word", () => {
    expect(invoiceAmounts(lines, { gstOn: true, gstin: TN, gstRatePct: 18 }, { gstin: KA }).gstKind).toBe("igst")
    expect(invoiceAmounts(lines, { gstOn: true, gstin: TN, gstRatePct: 18 }, { otherState: true }).gstKind).toBe("igst")
    expect(invoiceAmounts(lines, { gstOn: true, gstin: TN, gstRatePct: 18 }, {}).gstKind).toBe("cgst_sgst")
  })
})

describe("invoice numbers", () => {
  it("count per Indian financial year", () => {
    expect(invoiceNumber(new Date("2026-11-14T10:00:00+05:30"), 7)).toBe("FFY/26-27/0007")
    expect(invoiceNumber(new Date("2027-03-31T23:00:00+05:30"), 1)).toBe("FFY/26-27/0001")
    expect(invoiceNumber(new Date("2027-04-01T00:30:00+05:30"), 1)).toBe("FFY/27-28/0001")
    expect(invoiceNumberPrefix(new Date("2026-11-14T10:00:00+05:30"))).toBe("FFY/26-27/")
    expect(invoiceNumber(new Date(), 1).length).toBeLessThanOrEqual(16)
  })
})

describe("invoice state", () => {
  it("is overdue after its due date, until paid", () => {
    expect(invoiceState({ status: "due", dueOn: "2026-11-14" }, "2026-11-14")).toBe("due")
    expect(invoiceState({ status: "due", dueOn: "2026-11-13" }, "2026-11-14")).toBe("overdue")
    expect(invoiceState({ status: "paid", dueOn: "2026-11-01" }, "2026-11-14")).toBe("paid")
    expect(invoiceState({ status: "void", dueOn: "2026-11-01" }, "2026-11-14")).toBe("void")
  })
})

describe("draft lines", () => {
  const plan = { monthlyPaise: 49_900, yearlyPaise: 499_000 }
  const addOns = [{ key: "fishery" as const, name: "Fishery", monthlyPaise: 19_900, yearlyPaise: null }]
  it("bills a month of the plan and its add-ons", () => {
    const d = draftLines({ billingCycle: "monthly", priceOverridePaise: null, addOns: ["fishery", "nope"] }, plan, addOns, "2026-11-15", "Poultry farm")
    expect(d).toEqual({ periodStart: "2026-11-15", periodEnd: "2026-12-14", lines: [{ text: "Poultry farm", amountPaise: 49_900 }, { text: "Fishery", amountPaise: 19_900 }] })
  })
  it("bills a year, with the farm's own price", () => {
    const d = draftLines({ billingCycle: "yearly", priceOverridePaise: 400_000, addOns: ["fishery"] }, plan, addOns, "2026-01-31", "Poultry farm")
    expect(d.periodEnd).toBe("2027-01-30")
    expect(d.lines).toEqual([{ text: "Poultry farm", amountPaise: 400_000 }, { text: "Fishery", amountPaise: 238_800 }])
  })
})

describe("announcements", () => {
  const a = { startsOn: "2026-11-10", endsOn: "2026-11-20", onlyFarms: [] as string[], audience: "owners" }
  it("are live between their dates", () => {
    expect(announcementState(a, "2026-11-09")).toBe("coming")
    expect(announcementState(a, "2026-11-20")).toBe("live")
    expect(announcementState(a, "2026-11-21")).toBe("ended")
    expect(announcementState({ ...a, endsOn: null }, "2030-01-01")).toBe("live")
  })
  it("reach the chosen farms and people", () => {
    expect(announcementFor(a, "f1", true, "2026-11-12")).toBe(true)
    expect(announcementFor(a, "f1", false, "2026-11-12")).toBe(false)
    expect(announcementFor({ ...a, audience: "everyone" }, "f1", false, "2026-11-12")).toBe(true)
    expect(announcementFor({ ...a, onlyFarms: ["f2"] }, "f1", true, "2026-11-12")).toBe(false)
  })
})
