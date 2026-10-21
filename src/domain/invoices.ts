import { financialYear } from "./ist"

/** "MF/2026-27/0001" — numbered per farm per Indian financial year (April–March). */
export function invoiceNumber(prefix: string, fy: string, seq: number): string {
  return `${prefix}/${fy}/${String(seq).padStart(4, "0")}`
}

export { financialYear }

/**
 * A tax invoice needs a GSTIN and at least one taxable line; otherwise a bill of supply
 * (GST-exempt goods such as fresh eggs, or a farm that is not GST-registered).
 */
export function invoiceTypeFor(gstin: string | null | undefined, lineRates: number[]): "tax_invoice" | "bill_of_supply" {
  return gstin && lineRates.some((r) => r > 0) ? "tax_invoice" : "bill_of_supply"
}
