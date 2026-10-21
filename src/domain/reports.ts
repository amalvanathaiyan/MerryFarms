/**
 * Report figures, computed from plain rows so they can be tested without a database.
 * Sales are counted when an order is delivered; returns reduce sales in the period
 * the goods came back. All dates are IST "YYYY-MM-DD".
 */
import { addDays, daysBetween, istDate, weekday } from "./ist"

export type RangeKey = "today" | "week" | "month" | "custom"

/** today / this week (Monday to today) / this month (1st to today). */
export function rangeFor(key: Exclude<RangeKey, "custom">, now: Date): { from: string; to: string } {
  const today = istDate(now)
  if (key === "today") return { from: today, to: today }
  if (key === "week") return { from: addDays(today, -((weekday(today) + 6) % 7)), to: today }
  return { from: `${today.slice(0, 8)}01`, to: today }
}

/** A custom range, clamped to at most a year and with from ≤ to. */
export function cleanRange(from: string | undefined, to: string | undefined, now: Date): { from: string; to: string } | null {
  const ymd = /^\d{4}-\d{2}-\d{2}$/
  if (!from || !to || !ymd.test(from) || !ymd.test(to)) return null
  const [a, b] = from <= to ? [from, to] : [to, from]
  const today = istDate(now)
  const end = b > today ? today : b
  if (daysBetween(a, end) > 366) return { from: addDays(end, -366), to: end }
  return { from: a, to: end }
}

export interface DeliveredOrder {
  date: string // IST delivery date
  channel: string
  totalPaise: number
  deliveryFeePaise: number
  items: { productId: string; qty: number; unitPricePaise: number }[]
}
export interface ReturnRow {
  date: string
  amountPaise: number
  items: { productId: string; qty: number; unitPricePaise: number }[]
}
export interface PaymentRow {
  method: string // cash_on_delivery | upi_on_delivery | upi_prepaid
  status: string // received | refunded
  amountPaise: number
}

export interface SalesSummary {
  orders: number
  grossPaise: number
  returnsPaise: number
  netPaise: number
  averagePaise: number
  deliveryFeesPaise: number
  byChannel: Record<string, { orders: number; paise: number }>
  collected: { cashPaise: number; upiPaise: number; refundsPaise: number }
  /** Delivered on account, not yet paid in the period (part of net sales). */
  onAccountPaise: number
}

export function salesSummary(orders: DeliveredOrder[], returns: ReturnRow[], payments: PaymentRow[]): SalesSummary {
  const grossPaise = orders.reduce((a, o) => a + o.totalPaise, 0)
  const returnsPaise = returns.reduce((a, r) => a + r.amountPaise, 0)
  const byChannel: SalesSummary["byChannel"] = {}
  for (const o of orders) {
    const c = (byChannel[o.channel] ??= { orders: 0, paise: 0 })
    c.orders++
    c.paise += o.totalPaise
  }
  const received = payments.filter((p) => p.status === "received")
  const cashPaise = received.filter((p) => p.method === "cash_on_delivery").reduce((a, p) => a + p.amountPaise, 0)
  const upiPaise = received.filter((p) => p.method !== "cash_on_delivery").reduce((a, p) => a + p.amountPaise, 0)
  const refundsPaise = payments.filter((p) => p.status === "refunded").reduce((a, p) => a + p.amountPaise, 0)
  const netPaise = grossPaise - returnsPaise
  return {
    orders: orders.length,
    grossPaise,
    returnsPaise,
    netPaise,
    averagePaise: orders.length ? Math.round(grossPaise / orders.length) : 0,
    deliveryFeesPaise: orders.reduce((a, o) => a + o.deliveryFeePaise, 0),
    byChannel,
    collected: { cashPaise, upiPaise, refundsPaise },
    onAccountPaise: Math.max(0, grossPaise - cashPaise - upiPaise),
  }
}

/** Net sales per day for every day in the range (days with no sales are 0). */
export function dailySeries(from: string, to: string, orders: DeliveredOrder[], returns: ReturnRow[]): { date: string; paise: number }[] {
  const byDay = new Map<string, number>()
  for (const o of orders) byDay.set(o.date, (byDay.get(o.date) ?? 0) + o.totalPaise)
  for (const r of returns) byDay.set(r.date, (byDay.get(r.date) ?? 0) - r.amountPaise)
  const out: { date: string; paise: number }[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, paise: byDay.get(d) ?? 0 })
  return out
}

/** Quantity and value per product, net of returns, biggest first. */
export function productTotals(orders: DeliveredOrder[], returns: ReturnRow[]): { productId: string; qty: number; paise: number }[] {
  const m = new Map<string, { qty: number; paise: number }>()
  const add = (productId: string, qty: number, paise: number) => {
    const r = m.get(productId) ?? { qty: 0, paise: 0 }
    r.qty += qty
    r.paise += paise
    m.set(productId, r)
  }
  for (const o of orders) for (const i of o.items) add(i.productId, i.qty, i.qty * i.unitPricePaise)
  for (const r of returns) for (const i of r.items) add(i.productId, -i.qty, -i.qty * i.unitPricePaise)
  return [...m.entries()].map(([productId, v]) => ({ productId, ...v })).sort((a, b) => b.paise - a.paise)
}

export interface CallStats {
  ordersCalled: number
  confirmed: number
  changed: number
  cancelled: number
  noAnswerAttempts: number
  wrongNumber: number
  /** Orders cancelled on the call ÷ orders that got a call outcome. The target is under 2%. */
  accidentalRate: number
}

/** From each order's final call outcome plus every unanswered attempt. */
export function callStats(calls: { orderId: string; outcome: string; at: Date }[]): CallStats {
  const last = new Map<string, string>()
  for (const c of [...calls].sort((a, b) => a.at.getTime() - b.at.getTime())) if (c.outcome !== "no_answer") last.set(c.orderId, c.outcome)
  const count = (o: string) => [...last.values()].filter((v) => v === o).length
  const decided = last.size
  const cancelled = count("cancelled")
  return {
    ordersCalled: new Set(calls.map((c) => c.orderId)).size,
    confirmed: count("confirmed"),
    changed: count("changed"),
    cancelled,
    noAnswerAttempts: calls.filter((c) => c.outcome === "no_answer").length,
    wrongNumber: count("wrong_number"),
    accidentalRate: decided ? cancelled / decided : 0,
  }
}

/**
 * CSV for Excel: UTF-8 with a byte-order mark (so Tamil shows correctly when opened),
 * CRLF line ends, every cell quoted when needed. Cells starting with = + - @ are
 * prefixed with ' so a spreadsheet never runs them as formulas.
 */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    if (v === null) return ""
    if (typeof v === "number") return String(v)
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
}

/** Rupees with two decimals for spreadsheets (no ₹ sign, no grouping). */
export const csvRupees = (paise: number) => (paise / 100).toFixed(2)
