import { describe, expect, it } from "vitest"
import { addDays, financialYear, istDate, istInstant, weekday } from "./ist"
import { formatRupees, includedTax } from "./money"
import { deliveryFee, orderTotals } from "./pricing"
import { slotRangeLabel, upcomingSlots, validateSlotRule, type SlotRule } from "./slots"
import { afterCall, canTransition, decideCall, nextStep, type CallRules } from "./orders"
import { invoiceNumber, invoiceTypeFor } from "./invoices"
import { formatIndianMobile, normaliseIndianMobile } from "./phone"
import { liteOrderMessage, waMeLink } from "./whatsapp-lite"

describe("IST dates", () => {
  it("uses the Indian calendar date, not UTC", () => {
    expect(istDate(new Date("2026-10-21T18:29:00Z"))).toBe("2026-10-21") // 23:59 IST
    expect(istDate(new Date("2026-10-21T18:30:00Z"))).toBe("2026-10-22") // 00:00 IST
  })
  it("computes weekdays and day arithmetic across months", () => {
    expect(weekday("2026-10-21")).toBe(3) // Wednesday
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02")
  })
  it("turns IST wall time into the right instant", () => {
    expect(istInstant("2026-10-22", "07:00").toISOString()).toBe("2026-10-22T01:30:00.000Z")
  })
  it("rolls the financial year over on 1 April IST", () => {
    expect(financialYear(new Date("2026-03-31T18:29:00Z"))).toBe("2025-26")
    expect(financialYear(new Date("2026-03-31T18:30:00Z"))).toBe("2026-27")
  })
})

describe("money", () => {
  it("formats with Indian grouping", () => {
    expect(formatRupees(12_345_000)).toBe("₹1,23,450")
    expect(formatRupees(16_850)).toBe("₹168.50")
  })
  it("extracts GST from an inclusive price", () => {
    expect(includedTax(10_500, 5)).toBe(500)
    expect(includedTax(10_000, 0)).toBe(0)
  })
})

describe("pricing", () => {
  const rule = { deliveryFeePaise: 3000, freeAbovePaise: 50_000 }
  it("charges delivery below the free threshold only", () => {
    expect(deliveryFee(16_800, rule)).toBe(3000)
    expect(deliveryFee(50_000, rule)).toBe(0)
    expect(deliveryFee(0, rule)).toBe(0)
    expect(deliveryFee(90_000, { deliveryFeePaise: 3000, freeAbovePaise: 0 })).toBe(3000)
  })
  it("totals lines and groups included GST by rate", () => {
    const t = orderTotals(
      [
        { qty: 2, unitPricePaise: 39_000, gstRate: 0 },
        { qty: 1, unitPricePaise: 65_000, gstRate: 5 },
      ],
      rule
    )
    expect(t).toMatchObject({ subtotalPaise: 143_000, deliveryFeePaise: 0, totalPaise: 143_000, taxPaise: 3095 })
    expect(t.taxByRate).toEqual({ 5: 3095 })
  })
  it("rejects zero or fractional quantities", () => {
    expect(() => orderTotals([{ qty: 0, unitPricePaise: 100, gstRate: 0 }], rule)).toThrow()
    expect(() => orderTotals([{ qty: 1.5, unitPricePaise: 100, gstRate: 0 }], rule)).toThrow()
  })
})

describe("delivery slots", () => {
  const daily = [0, 1, 2, 3, 4, 5, 6]
  const slots: SlotRule[] = [
    { id: "eve", startTime: "17:00", endTime: "19:00", daysOfWeek: daily, cutoffHours: 6, maxOrders: 15, isActive: true },
    { id: "am", startTime: "07:00", endTime: "09:00", daysOfWeek: daily, cutoffHours: 12, maxOrders: 20, isActive: true },
  ]
  const now = new Date("2026-10-21T10:00:00Z") // Wed 15:30 IST

  it("labels ranges like people say them", () => {
    expect(slotRangeLabel("07:00", "09:00")).toBe("7–9 AM")
    expect(slotRangeLabel("11:00", "13:00")).toBe("11 AM–1 PM")
    expect(slotRangeLabel("05:30", "07:00")).toBe("5:30–7 AM")
    expect(slotRangeLabel("12:00", "14:00")).toBe("12–2 PM")
  })

  it("skips occurrences past their cut-off and orders by date then time", () => {
    const opts = upcomingSlots(slots, {}, now, { wantOpen: 3 })
    expect(opts.map((o) => o.key)).toEqual(["2026-10-22|am", "2026-10-22|eve", "2026-10-23|am"])
    expect(opts[0].cutoffAt.toISOString()).toBe("2026-10-21T13:30:00.000Z") // 19:00 IST today
  })

  it("closes exactly at the cut-off", () => {
    const atCutoff = new Date("2026-10-21T13:30:00Z")
    expect(upcomingSlots(slots, {}, atCutoff, { wantOpen: 1 })[0].key).toBe("2026-10-22|eve")
  })

  it("shows full occurrences but keeps looking for open ones", () => {
    const opts = upcomingSlots(slots, { "2026-10-22|am": 20 }, now, { wantOpen: 2 })
    expect(opts.map((o) => [o.key, o.full])).toEqual([
      ["2026-10-22|am", true],
      ["2026-10-22|eve", false],
      ["2026-10-23|am", false],
    ])
  })

  it("respects days of week and inactive slots", () => {
    const saturdayOnly: SlotRule[] = [{ ...slots[1], daysOfWeek: [6] }, { ...slots[0], isActive: false }]
    expect(upcomingSlots(saturdayOnly, {}, now, { wantOpen: 1 })[0].date).toBe("2026-10-24")
  })

  it("validates farm-entered slot rules", () => {
    const ok = { startTime: "07:00", endTime: "09:00", daysOfWeek: [1], cutoffHours: 12, maxOrders: 5 }
    expect(validateSlotRule(ok)).toBeNull()
    expect(validateSlotRule({ ...ok, endTime: "06:00" })).toBe("end_before_start")
    expect(validateSlotRule({ ...ok, daysOfWeek: [] })).toBe("no_days")
    expect(validateSlotRule({ ...ok, startTime: "7:00" })).toBe("time_format")
    expect(validateSlotRule({ ...ok, maxOrders: 0 })).toBe("bad_capacity")
  })
})

describe("order lifecycle", () => {
  it("only allows real transitions", () => {
    expect(canTransition("to_confirm", "confirmed")).toBe(true)
    expect(canTransition("to_confirm", "packed")).toBe(false)
    expect(canTransition("out_for_delivery", "cancelled")).toBe(false)
    expect(canTransition("delivered", "cancelled")).toBe(false)
    expect(nextStep("packed")).toBe("out_for_delivery")
    expect(nextStep("delivered")).toBeNull()
  })

  it("retries unanswered calls, then hands over to the owner", () => {
    expect(afterCall("no_answer", 1, 3)).toEqual({ status: null, retry: true, needsOwner: false })
    expect(afterCall("no_answer", 3, 3)).toEqual({ status: null, retry: false, needsOwner: true })
    expect(afterCall("changed", 1, 3).status).toBe("confirmed")
    expect(afterCall("cancelled", 1, 3).status).toBe("cancelled")
  })
})

describe("confirmation-call rules", () => {
  const rules: CallRules = {
    callWhatsAppOrders: true,
    callWebOrdersFromNew: true,
    newCustomerOrderCount: 3,
    callAboveTotalPaise: 150_000,
    callAboveUsualMultiple: 3,
    skipCallForTrusted: true,
    skipCallForPrepaid: true,
  }
  const regular = { isTrusted: false, deliveredOrders: 10, usualOrderPaise: 40_000 }

  it("calls every WhatsApp order by default", () => {
    expect(decideCall(rules, { channel: "whatsapp", paymentMethod: "upi_on_delivery", totalPaise: 39_000, customer: regular }))
      .toEqual({ needsCall: true, reason: "whatsapp_order" })
  })
  it("lets trusted customers and prepaid orders skip the call", () => {
    const trusted = { ...regular, isTrusted: true }
    expect(decideCall(rules, { channel: "whatsapp", paymentMethod: "cash_on_delivery", totalPaise: 39_000, customer: trusted }).needsCall).toBe(false)
    expect(decideCall(rules, { channel: "whatsapp", paymentMethod: "upi_prepaid", totalPaise: 39_000, customer: regular }).needsCall).toBe(false)
  })
  it("always calls on large or unusual orders, even for trusted customers", () => {
    const trusted = { ...regular, isTrusted: true }
    expect(decideCall(rules, { channel: "whatsapp", paymentMethod: "upi_prepaid", totalPaise: 200_000, customer: trusted }).reason).toBe("large_order")
    expect(decideCall(rules, { channel: "web", paymentMethod: "upi_on_delivery", totalPaise: 130_000, customer: trusted }).reason).toBe("unusual_order")
  })
  it("calls web orders only from new customers", () => {
    expect(decideCall(rules, { channel: "web", paymentMethod: "upi_on_delivery", totalPaise: 39_000, customer: regular }).needsCall).toBe(false)
    expect(decideCall(rules, { channel: "web", paymentMethod: "upi_on_delivery", totalPaise: 39_000, customer: { ...regular, deliveredOrders: 1 } }).reason).toBe("new_customer")
  })
  it("never calls for orders taken by phone or at the farm, or plan orders", () => {
    expect(decideCall(rules, { channel: "phone", paymentMethod: "cash_on_delivery", totalPaise: 900_000, customer: regular }).needsCall).toBe(false)
    expect(decideCall(rules, { channel: "whatsapp", paymentMethod: "upi_on_delivery", totalPaise: 39_000, isPlanOrder: true, customer: regular }).needsCall).toBe(false)
  })
})

describe("invoices", () => {
  it("numbers per farm per financial year", () => {
    expect(invoiceNumber("MF", "2026-27", 1)).toBe("MF/2026-27/0001")
    expect(invoiceNumber("MF", "2026-27", 12345)).toBe("MF/2026-27/12345")
  })
  it("issues a bill of supply for exempt goods or unregistered farms", () => {
    expect(invoiceTypeFor(null, [5])).toBe("bill_of_supply")
    expect(invoiceTypeFor("33ABCDE1234F1Z5", [0, 0])).toBe("bill_of_supply")
    expect(invoiceTypeFor("33ABCDE1234F1Z5", [0, 5])).toBe("tax_invoice")
  })
})

describe("phone numbers", () => {
  it("normalises the ways people write Indian mobiles", () => {
    for (const input of ["90000 10001", "+91 90000 10001", "09000010001", "919000010001", "+91-90000-10001"]) {
      expect(normaliseIndianMobile(input)).toBe("+919000010001")
    }
  })
  it("rejects landlines and short numbers", () => {
    expect(normaliseIndianMobile("044 2345 6789")).toBeNull()
    expect(normaliseIndianMobile("12345")).toBeNull()
  })
  it("formats for display", () => {
    expect(formatIndianMobile("+919000010001")).toBe("+91 90000 10001")
  })
})

describe("WhatsApp Lite messages", () => {
  const order = {
    code: "MF-1047",
    customerName: "Priya",
    farmName: "Merry Farms",
    items: [{ name: "நாட்டுக் கோழி முட்டை", pack: "30 முட்டை", qty: 2 }],
    totalPaise: 78_000,
    slotText: "நாளை 7–9 AM",
    paymentText: "UPI",
  }
  it("builds a wa.me link with the message encoded", () => {
    const link = waMeLink("+919000010001", "வணக்கம் & hi")
    expect(link.startsWith("https://wa.me/919000010001?text=")).toBe(true)
    expect(decodeURIComponent(link.split("text=")[1])).toBe("வணக்கம் & hi")
  })
  it("writes Tamil by default and English on request", () => {
    expect(liteOrderMessage("confirmed", order, "ta")).toContain("உறுதி செய்யப்பட்டது")
    expect(liteOrderMessage("confirmed", order, "ta")).toContain("₹780")
    expect(liteOrderMessage("received", order, "en")).toContain("2 × நாட்டுக் கோழி முட்டை (30 முட்டை)")
  })
})
