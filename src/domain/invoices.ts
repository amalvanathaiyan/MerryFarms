import { financialYear } from "./ist"
import { includedTax } from "./money"

/** "MF/2026-27/0001" — numbered per farm per Indian financial year (April–March). */
export function invoiceNumber(prefix: string, fy: string, seq: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(4, "0")}`
}

/** Credit notes run their own series: "MF-CN/2026-27/0001". */
export function creditNoteNumber(prefix: string, fy: string, seq: number): string {
  return invoiceNumber(`${prefix}-CN`, fy, seq)
}

export { financialYear }

/**
 * A tax invoice needs a GSTIN and at least one taxable line; otherwise a bill of supply
 * (GST-exempt goods such as fresh eggs, or a farm that is not GST-registered).
 */
export function invoiceTypeFor(gstin: string | null | undefined, lineRates: number[]): "tax_invoice" | "bill_of_supply" {
  return gstin && lineRates.some((r) => r > 0) ? "tax_invoice" : "bill_of_supply"
}

/** Everything printed on an invoice, frozen at the moment it is issued. */
export interface InvoiceSnapshot {
  version: 1
  type: "tax_invoice" | "bill_of_supply" | "credit_note"
  /** Credit notes only: the invoice being corrected and why. */
  against?: { number: string; type: "tax_invoice" | "bill_of_supply" }
  reason?: string
  number: string
  issuedAt: string // ISO instant
  orderCode: string
  farm: { nameTa: string; nameEn: string; phone: string; gstin: string | null; fssaiNo: string | null; upiId: string | null }
  customer: { name: string; phone: string; address: string | null }
  lines: {
    nameTa: string
    nameEn: string
    packTa: string
    packEn: string
    hsn: string | null
    qty: number
    unitPricePaise: number // GST-inclusive
    amountPaise: number
    gstRate: number
    taxPaise: number // GST included in amountPaise
  }[]
  subtotalPaise: number
  deliveryFeePaise: number
  totalPaise: number
  /** Intra-state supply (a farm selling locally): GST splits equally into CGST and SGST. */
  taxByRate: { rate: number; taxablePaise: number; cgstPaise: number; sgstPaise: number }[]
  taxPaise: number
}

export interface SnapshotInput {
  number: string
  issuedAt: Date
  orderCode: string
  farm: InvoiceSnapshot["farm"]
  customer: InvoiceSnapshot["customer"]
  lines: Omit<InvoiceSnapshot["lines"][number], "amountPaise" | "taxPaise">[]
  deliveryFeePaise: number
  /** Build a credit note against this invoice instead of an invoice. */
  creditNoteFor?: { number: string; type: "tax_invoice" | "bill_of_supply"; reason: string }
}

export function buildInvoiceSnapshot(input: SnapshotInput): InvoiceSnapshot {
  const lines = input.lines.map((l) => {
    const amountPaise = l.qty * l.unitPricePaise
    return { ...l, amountPaise, taxPaise: includedTax(amountPaise, l.gstRate) }
  })
  // A credit note follows the tax treatment of the invoice it corrects.
  const taxed = input.creditNoteFor ? input.creditNoteFor.type === "tax_invoice" : invoiceTypeFor(input.farm.gstin, lines.map((l) => l.gstRate)) === "tax_invoice"
  const type = input.creditNoteFor ? "credit_note" : taxed ? "tax_invoice" : "bill_of_supply"

  const byRate = new Map<number, { taxablePaise: number; taxPaise: number }>()
  if (taxed) {
    for (const l of lines) {
      if (l.gstRate <= 0) continue
      const r = byRate.get(l.gstRate) ?? { taxablePaise: 0, taxPaise: 0 }
      r.taxPaise += l.taxPaise
      r.taxablePaise += l.amountPaise - l.taxPaise
      byRate.set(l.gstRate, r)
    }
  }
  const taxByRate = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, r]) => {
      const cgstPaise = Math.floor(r.taxPaise / 2)
      return { rate, taxablePaise: r.taxablePaise, cgstPaise, sgstPaise: r.taxPaise - cgstPaise }
    })

  const subtotalPaise = lines.reduce((a, l) => a + l.amountPaise, 0)
  return {
    version: 1,
    type,
    ...(input.creditNoteFor && { against: { number: input.creditNoteFor.number, type: input.creditNoteFor.type }, reason: input.creditNoteFor.reason }),
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    orderCode: input.orderCode,
    farm: input.farm,
    customer: input.customer,
    lines,
    subtotalPaise,
    deliveryFeePaise: input.deliveryFeePaise,
    totalPaise: subtotalPaise + input.deliveryFeePaise,
    taxByRate,
    taxPaise: taxByRate.reduce((a, r) => a + r.cgstPaise + r.sgstPaise, 0),
  }
}
