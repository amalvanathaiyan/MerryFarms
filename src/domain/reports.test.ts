import { describe, expect, it } from "vitest"
import { callStats, cleanRange, csvRupees, dailySeries, productTotals, rangeFor, salesSummary, toCsv, type DeliveredOrder } from "./reports"

const NOW = new Date("2026-10-21T10:00:00Z") // Wed 21 Oct, IST

describe("report periods", () => {
  it("covers today, Monday-to-today, and the month so far", () => {
    expect(rangeFor("today", NOW)).toEqual({ from: "2026-10-21", to: "2026-10-21" })
    expect(rangeFor("week", NOW)).toEqual({ from: "2026-10-19", to: "2026-10-21" })
    expect(rangeFor("month", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-21" })
  })
  it("cleans a custom range: swaps reversed dates, stops at today, caps at a year", () => {
    expect(cleanRange("2026-10-10", "2026-10-01", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-10" })
    expect(cleanRange("2026-10-01", "2026-12-31", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-21" })
    expect(cleanRange("2020-01-01", "2026-10-21", NOW)!.from).toBe("2025-10-20")
    expect(cleanRange("bad", "2026-10-01", NOW)).toBeNull()
  })
})

const orders: DeliveredOrder[] = [
  { date: "2026-10-19", channel: "whatsapp", totalPaise: 78_000, deliveryFeePaise: 0, items: [{ productId: "eggs", qty: 2, unitPricePaise: 39_000 }] },
  { date: "2026-10-19", channel: "web", totalPaise: 19_800, deliveryFeePaise: 3000, items: [{ productId: "eggs12", qty: 1, unitPricePaise: 16_800 }] },
  { date: "2026-10-21", channel: "walk_in", totalPaise: 68_000, deliveryFeePaise: 0, items: [{ productId: "chicken", qty: 1, unitPricePaise: 68_000 }] },
]
const returns = [{ date: "2026-10-20", amountPaise: 39_000, items: [{ productId: "eggs", qty: 1, unitPricePaise: 39_000 }] }]
const payments = [
  { method: "cash_on_delivery", status: "received", amountPaise: 68_000 },
  { method: "upi_on_delivery", status: "received", amountPaise: 19_800 },
  { method: "cash_on_delivery", status: "refunded", amountPaise: 39_000 },
]

describe("sales", () => {
  it("summarises sales net of returns, by channel, and money collected", () => {
    const s = salesSummary(orders, returns, payments)
    expect(s).toMatchObject({ orders: 3, grossPaise: 165_800, returnsPaise: 39_000, netPaise: 126_800, averagePaise: 55_267, deliveryFeesPaise: 3000 })
    expect(s.byChannel).toEqual({ whatsapp: { orders: 1, paise: 78_000 }, web: { orders: 1, paise: 19_800 }, walk_in: { orders: 1, paise: 68_000 } })
    expect(s.collected).toEqual({ cashPaise: 68_000, upiPaise: 19_800, refundsPaise: 39_000 })
    expect(s.onAccountPaise).toBe(78_000)
  })
  it("is all zeros for an empty period", () => {
    expect(salesSummary([], [], [])).toMatchObject({ orders: 0, netPaise: 0, averagePaise: 0 })
  })
  it("gives every day in the range, returns on the day they came back", () => {
    expect(dailySeries("2026-10-19", "2026-10-21", orders, returns)).toEqual([
      { date: "2026-10-19", paise: 97_800 },
      { date: "2026-10-20", paise: -39_000 },
      { date: "2026-10-21", paise: 68_000 },
    ])
  })
  it("totals products net of returns, biggest first", () => {
    expect(productTotals(orders, returns)).toEqual([
      { productId: "chicken", qty: 1, paise: 68_000 },
      { productId: "eggs", qty: 1, paise: 39_000 },
      { productId: "eggs12", qty: 1, paise: 16_800 },
    ])
  })
})

describe("calls", () => {
  it("counts each order's final outcome and every unanswered attempt", () => {
    const t = (m: number) => new Date(Date.UTC(2026, 9, 21, 4, m))
    const s = callStats([
      { orderId: "a", outcome: "no_answer", at: t(0) },
      { orderId: "a", outcome: "confirmed", at: t(30) },
      { orderId: "b", outcome: "cancelled", at: t(5) },
      { orderId: "c", outcome: "changed", at: t(6) },
      { orderId: "d", outcome: "no_answer", at: t(7) },
    ])
    expect(s).toMatchObject({ ordersCalled: 4, confirmed: 1, changed: 1, cancelled: 1, noAnswerAttempts: 2, wrongNumber: 0 })
    expect(s.accidentalRate).toBeCloseTo(1 / 3)
  })
})

describe("CSV for Excel", () => {
  it("starts with a BOM, quotes where needed, and defuses formulas", () => {
    const csv = toCsv(["பெயர்", "Amount"], [["பிரியா, Lake View", 390], ['He said "hi"', null], ["=SUM(A1)", "-5"]])
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv).toBe('﻿பெயர்,Amount\r\n"பிரியா, Lake View",390\r\n"He said ""hi""",\r\n\'=SUM(A1),\'-5\r\n')
    expect(csvRupees(39_050)).toBe("390.50")
  })
})
