import { describe, expect, it } from "vitest"
import { buildInvoiceSnapshot, type SnapshotInput } from "./invoices"
import { ledgerBalance, runningBalances, withinCreditLimit } from "./ledger"
import { isValidUpiId, upiPayLink } from "./upi"

const base: SnapshotInput = {
  number: "MF/2026-27/0001",
  issuedAt: new Date("2026-10-22T03:00:00Z"),
  orderCode: "MF-1047",
  farm: { nameTa: "மெர்ரி ஃபார்ம்ஸ்", nameEn: "Merry Farms", phone: "+919000020001", gstin: null, fssaiNo: "12345678901234", upiId: "merryfarms@upi" },
  customer: { name: "Priya", phone: "+919000010001", address: "12, Lake View Road" },
  lines: [{ nameTa: "முட்டை", nameEn: "Eggs", packTa: "30", packEn: "Tray of 30", hsn: "0407", qty: 2, unitPricePaise: 39_000, gstRate: 0 }],
  deliveryFeePaise: 0,
}

describe("invoice snapshot", () => {
  it("is a bill of supply for exempt goods, with no tax", () => {
    const s = buildInvoiceSnapshot(base)
    expect(s).toMatchObject({ type: "bill_of_supply", subtotalPaise: 78_000, totalPaise: 78_000, taxPaise: 0, taxByRate: [] })
    expect(s.lines[0]).toMatchObject({ amountPaise: 78_000, taxPaise: 0 })
  })

  it("is a tax invoice for a GST farm with taxable lines, splitting CGST and SGST", () => {
    const s = buildInvoiceSnapshot({
      ...base,
      farm: { ...base.farm, gstin: "33ABCDE1234F1Z5" },
      lines: [...base.lines, { nameTa: "நெய்", nameEn: "Ghee", packTa: "500 மி.லி", packEn: "500 ml", hsn: "0405", qty: 1, unitPricePaise: 65_000, gstRate: 5 }],
      deliveryFeePaise: 3000,
    })
    expect(s.type).toBe("tax_invoice")
    expect(s.totalPaise).toBe(146_000)
    // ₹650 inclusive of 5% → ₹30.95 tax, split 15.47 + 15.48
    expect(s.taxByRate).toEqual([{ rate: 5, taxablePaise: 61_905, cgstPaise: 1547, sgstPaise: 1548 }])
    expect(s.taxPaise).toBe(3095)
  })

  it("records no tax lines for an unregistered farm even on taxable goods", () => {
    const s = buildInvoiceSnapshot({ ...base, lines: [{ ...base.lines[0], gstRate: 5 }] })
    expect(s.type).toBe("bill_of_supply")
    expect(s.taxByRate).toEqual([])
  })
})

describe("khata", () => {
  const entries = [
    { type: "charge" as const, amountPaise: 78_000 },
    { type: "payment" as const, amountPaise: 50_000 },
    { type: "charge" as const, amountPaise: 16_800 },
    { type: "adjustment" as const, amountPaise: -800 },
  ]
  it("adds charges and subtracts payments", () => {
    expect(ledgerBalance(entries)).toBe(44_000)
    expect(ledgerBalance([])).toBe(0)
  })
  it("prints a running balance for statements", () => {
    expect(runningBalances(entries).map((e) => e.balancePaise)).toEqual([78_000, 28_000, 44_800, 44_000])
  })
  it("allows credit only within the limit", () => {
    expect(withinCreditLimit(44_000, 100_000, 50_000)).toBe(true)
    expect(withinCreditLimit(44_000, 100_000, 60_000)).toBe(false)
    expect(withinCreditLimit(0, 0, 100)).toBe(false) // no khata
  })
})

describe("UPI links", () => {
  it("validates UPI IDs", () => {
    expect(isValidUpiId("merryfarms@okaxis")).toBe(true)
    expect(isValidUpiId("9000020001@ybl")).toBe(true)
    expect(isValidUpiId("not a upi")).toBe(false)
    expect(isValidUpiId("@okaxis")).toBe(false)
  })
  it("builds a payment link with the amount in rupees", () => {
    const link = upiPayLink({ upiId: "merryfarms@okaxis", payeeName: "Merry Farms", amountPaise: 44_000, note: "MF dues" })
    expect(link.startsWith("upi://pay?")).toBe(true)
    const q = new URLSearchParams(link.split("?")[1])
    expect(Object.fromEntries(q)).toEqual({ pa: "merryfarms@okaxis", pn: "Merry Farms", am: "440.00", cu: "INR", tn: "MF dues" })
  })
})
