import { describe, expect, it } from "vitest"
import { planReturn, returnable } from "./returns"
import { ledgerBalance } from "./ledger"
import { buildInvoiceSnapshot, creditNoteNumber } from "./invoices"

const delivered = [
  { productId: "eggs", qty: 2, unitPricePaise: 39_000, gstRate: 0 },
  { productId: "ghee", qty: 1, unitPricePaise: 65_000, gstRate: 5 },
]
const noFee = { refundDeliveryFee: false, orderDeliveryFeePaise: 3000, deliveryFeeAlreadyRefunded: false }

describe("returns", () => {
  it("prices a partial return at the agreed price", () => {
    const p = planReturn(delivered, [], [{ productId: "eggs", qty: 1 }], noFee)
    expect(p).toMatchObject({ goodsPaise: 39_000, deliveryFeePaise: 0, totalPaise: 39_000, fullyReturned: false })
  })

  it("remembers earlier returns", () => {
    const earlier = [[{ productId: "eggs", qty: 1 }]]
    expect(Object.fromEntries(returnable(delivered, earlier))).toEqual({ eggs: 1, ghee: 1 })
    expect(() => planReturn(delivered, earlier, [{ productId: "eggs", qty: 2 }], noFee)).toThrow("too_many_returned")
  })

  it("refunds the delivery charge only when everything comes back, and only once", () => {
    const all = [{ productId: "eggs", qty: 2 }, { productId: "ghee", qty: 1 }]
    expect(() => planReturn(delivered, [], [{ productId: "eggs", qty: 2 }], { ...noFee, refundDeliveryFee: true })).toThrow("fee_needs_full_return")
    const p = planReturn(delivered, [], all, { ...noFee, refundDeliveryFee: true })
    expect(p).toMatchObject({ goodsPaise: 143_000, deliveryFeePaise: 3000, totalPaise: 146_000, fullyReturned: true })
    expect(planReturn(delivered, [], all, { ...noFee, refundDeliveryFee: true, deliveryFeeAlreadyRefunded: true }).deliveryFeePaise).toBe(0)
  })

  it("rejects products that weren't on the order, and empty returns", () => {
    expect(() => planReturn(delivered, [], [{ productId: "milk", qty: 1 }], noFee)).toThrow("not_on_order")
    expect(() => planReturn(delivered, [], [], noFee)).toThrow("nothing_to_return")
  })
})

describe("khata with returns and refunds", () => {
  it("a credit note reduces dues; a refund paid out brings the balance back", () => {
    // Delivered ₹780 on account, then 1 tray returned (₹390): dues ₹390.
    expect(ledgerBalance([{ type: "charge", amountPaise: 78_000 }, { type: "credit_note", amountPaise: 39_000 }])).toBe(39_000)
    // Paid ₹780 in cash, 1 tray returned and ₹390 handed back: nothing owed either way.
    expect(
      ledgerBalance([
        { type: "charge", amountPaise: 78_000 },
        { type: "payment", amountPaise: 78_000 },
        { type: "credit_note", amountPaise: 39_000 },
        { type: "refund", amountPaise: 39_000 },
      ])
    ).toBe(0)
  })
})

describe("credit notes", () => {
  it("runs its own number series", () => {
    expect(creditNoteNumber("MF", "2026-27", 1)).toBe("MF-CN/2026-27/0001")
  })

  it("follows the tax treatment of the invoice it corrects", () => {
    const base = {
      number: "MF-CN/2026-27/0001",
      issuedAt: new Date("2026-10-22T05:00:00Z"),
      orderCode: "MF-1047",
      farm: { nameTa: "ம", nameEn: "M", phone: "+919000020001", gstin: "33ABCDE1234F1Z5", fssaiNo: null, upiId: null },
      customer: { name: "Priya", phone: "+919000010001", address: null },
      lines: [{ nameTa: "நெய்", nameEn: "Ghee", packTa: "500", packEn: "500 ml", hsn: "0405", qty: 1, unitPricePaise: 65_000, gstRate: 5 }],
      deliveryFeePaise: 0,
    }
    const taxed = buildInvoiceSnapshot({ ...base, creditNoteFor: { number: "MF/2026-27/0007", type: "tax_invoice", reason: "damaged" } })
    expect(taxed).toMatchObject({ type: "credit_note", against: { number: "MF/2026-27/0007", type: "tax_invoice" }, reason: "damaged", totalPaise: 65_000, taxPaise: 3095 })
    const exempt = buildInvoiceSnapshot({ ...base, creditNoteFor: { number: "MF/2026-27/0008", type: "bill_of_supply", reason: "damaged" } })
    expect(exempt.taxByRate).toEqual([])
  })
})
