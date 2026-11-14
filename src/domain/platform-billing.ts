/**
 * Farm For You's billing of farms (docs/platform-plan.md §3.5), the pure part: its billing details and GST switch,
 * what a farm's next invoice holds, the GST on it, invoice numbers, and whether an invoice is due, overdue or paid.
 * Tested; src/server/platform-billing.ts loads and saves.
 *
 * GST is built in but switched off until Farm For You registers (§7). Switched on, it needs Farm For You's GSTIN;
 * prices are before GST, and GST is split CGST + SGST for a farm in the same state, IGST for another state.
 */
import { addDays, addMonths, financialYear } from "./ist"
import { isModuleKey, type ModuleKey } from "./modules"

export interface BillingProfile {
  /** The name on the invoice ("Farm For You") */
  name: string
  address: string
  phone: string
  email: string
  /** Where farms pay: a UPI ID, and bank details as one block of text */
  upiId: string
  bank: string
  /** Days from the invoice to its due date */
  dueDays: number
  gstOn: boolean
  gstin: string
  gstRatePct: number
  /** SAC code for the service (998314: IT design and development services) */
  sac: string
}

export const DEFAULT_PROFILE: BillingProfile = {
  name: "Farm For You",
  address: "",
  phone: "",
  email: "",
  upiId: "",
  bank: "",
  dueDays: 7,
  gstOn: false,
  gstin: "",
  gstRatePct: 18,
  sac: "998314",
}

export const GST_RATES = [5, 12, 18, 28] as const

/** A GSTIN: 2-digit state code, PAN (10), entity number, Z, check character. */
export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export const isGstin = (v: unknown): v is string => typeof v === "string" && GSTIN_RE.test(v)

/** The saved profile, every field checked, missing ones from the defaults. GST stays off without a valid GSTIN. */
export function cleanProfile(json: unknown): BillingProfile {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>
  const text = (k: keyof BillingProfile, max: number) => (typeof o[k] === "string" ? (o[k] as string).trim().slice(0, max) : (DEFAULT_PROFILE[k] as string))
  const gstin = text("gstin", 15).toUpperCase()
  const rate = Number(o.gstRatePct)
  const due = Number(o.dueDays)
  return {
    name: text("name", 80) || DEFAULT_PROFILE.name,
    address: text("address", 300),
    phone: text("phone", 20),
    email: text("email", 120),
    upiId: text("upiId", 80),
    bank: text("bank", 300),
    dueDays: Number.isInteger(due) && due >= 0 && due <= 90 ? due : DEFAULT_PROFILE.dueDays,
    gstOn: o.gstOn === true && isGstin(gstin),
    gstin,
    gstRatePct: (GST_RATES as readonly number[]).includes(rate) ? rate : DEFAULT_PROFILE.gstRatePct,
    sac: /^\d{4,8}$/.test(text("sac", 8)) ? text("sac", 8) : DEFAULT_PROFILE.sac,
  }
}

export interface InvoiceLine {
  text: string
  amountPaise: number
}

export function cleanLines(json: unknown): InvoiceLine[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((l): l is InvoiceLine => !!l && typeof l === "object" && typeof (l as InvoiceLine).text === "string" && Number.isInteger((l as InvoiceLine).amountPaise))
    .map((l) => ({ text: l.text, amountPaise: l.amountPaise }))
}

export type GstKind = "none" | "cgst_sgst" | "igst"

export interface Amounts {
  subtotalPaise: number
  gstRatePct: number
  gstKind: GstKind
  gstPaise: number
  totalPaise: number
}

/** The state code a GSTIN starts with ("33" = Tamil Nadu); null without one. */
export const gstinState = (gstin: string | null | undefined): string | null => (isGstin(gstin) ? gstin.slice(0, 2) : null)

/**
 * Totals for an invoice. GST off: no tax. On: the rate on the subtotal, CGST + SGST unless the farm is in another
 * state (known from its GSTIN, or said by admin when the farm has none).
 */
export function invoiceAmounts(lines: InvoiceLine[], profile: Pick<BillingProfile, "gstOn" | "gstin" | "gstRatePct">, buyer: { gstin?: string | null; otherState?: boolean }): Amounts {
  const subtotalPaise = lines.reduce((a, l) => a + l.amountPaise, 0)
  if (!profile.gstOn || !isGstin(profile.gstin)) return { subtotalPaise, gstRatePct: 0, gstKind: "none", gstPaise: 0, totalPaise: subtotalPaise }
  const theirs = gstinState(buyer.gstin)
  const other = theirs ? theirs !== gstinState(profile.gstin) : !!buyer.otherState
  // Split equally for CGST + SGST, so the tax is an even number of paise
  const raw = Math.round((subtotalPaise * profile.gstRatePct) / 100)
  const gstPaise = other ? raw : Math.round(raw / 2) * 2
  return { subtotalPaise, gstRatePct: profile.gstRatePct, gstKind: other ? "igst" : "cgst_sgst", gstPaise, totalPaise: subtotalPaise + gstPaise }
}

/** "FFY/26-27/0007": numbered from 1 in each financial year; at most 16 characters, as GST asks. */
export function invoiceNumber(at: Date, seq: number): string {
  const fy = financialYear(at)
  return `FFY/${fy.slice(2)}/${String(seq).padStart(4, "0")}`
}

/** The prefix every number in that financial year shares, to count them. */
export const invoiceNumberPrefix = (at: Date) => invoiceNumber(at, 0).slice(0, -4)

export type InvoiceState = "due" | "overdue" | "paid" | "void"

export function invoiceState(inv: { status: string; dueOn: string }, today: string): InvoiceState {
  if (inv.status === "void") return "void"
  if (inv.status === "paid") return "paid"
  return inv.dueOn < today ? "overdue" : "due"
}

/** After a payment: paid once the payments reach the total. */
export const isPaidUp = (totalPaise: number, paidPaise: number) => paidPaise >= totalPaise

/**
 * What a farm's next invoice holds, from its subscription: the plan (or the farm's own price) for the billing cycle
 * and each add-on module at its price, for the period starting the day after the last invoice ended (or today).
 */
export function draftLines(
  sub: { billingCycle: string; priceOverridePaise: number | null; addOns: string[] },
  plan: { monthlyPaise: number; yearlyPaise: number | null },
  addOnPrices: { key: ModuleKey; name: string; monthlyPaise: number | null; yearlyPaise: number | null }[],
  periodStart: string,
  planName: string
): { lines: InvoiceLine[]; periodStart: string; periodEnd: string } {
  const yearly = sub.billingCycle === "yearly"
  const periodEnd = addDays(addMonths(periodStart, yearly ? 12 : 1), -1)
  const planPaise = sub.priceOverridePaise ?? (yearly ? (plan.yearlyPaise ?? plan.monthlyPaise * 12) : plan.monthlyPaise)
  const lines: InvoiceLine[] = [{ text: planName, amountPaise: planPaise }]
  for (const key of sub.addOns.filter(isModuleKey)) {
    const p = addOnPrices.find((a) => a.key === key)
    if (!p) continue
    const amount = yearly ? (p.yearlyPaise ?? (p.monthlyPaise ?? 0) * 12) : (p.monthlyPaise ?? 0)
    if (amount > 0) lines.push({ text: p.name, amountPaise: amount })
  }
  return { lines, periodStart, periodEnd }
}

// ── Announcements ────────────────────────────────────────────────────────────

export const ANNOUNCEMENT_TONES = ["info", "important"] as const
export const ANNOUNCEMENT_AUDIENCES = ["owners", "everyone"] as const

/** live (shown now), coming (starts later) or ended. */
export function announcementState(a: { startsOn: string; endsOn: string | null }, today: string): "live" | "coming" | "ended" {
  if (a.startsOn > today) return "coming"
  if (a.endsOn && a.endsOn < today) return "ended"
  return "live"
}

/** Whether one staff member of a farm sees it today. */
export function announcementFor(a: { startsOn: string; endsOn: string | null; onlyFarms: string[]; audience: string }, tenantId: string, isOwner: boolean, today: string): boolean {
  if (announcementState(a, today) !== "live") return false
  if (a.onlyFarms.length > 0 && !a.onlyFarms.includes(tenantId)) return false
  return a.audience === "everyone" || isOwner
}
