import { describe, expect, it } from "vitest"
import { customerMessageNote, customerOrderNote, staffMessageNote, staffNewOrderNote } from "./notifications"

describe("notification wording", () => {
  it("tells the customer about their order in their language", () => {
    expect(customerOrderNote("confirmed", "ta", { farm: "மெர்ரி ஃபார்ம்ஸ்", code: "MF-1047", slotText: "நாளை 7–9 AM", totalPaise: 78_000 })).toEqual({
      title: "மெர்ரி ஃபார்ம்ஸ்: ஆர்டர் MF-1047 உறுதி",
      body: "நாளை 7–9 AM · ₹780",
      url: "/my",
      tag: "order-MF-1047",
    })
    expect(customerOrderNote("out_for_delivery", "en", { farm: "Merry Farms", code: "MF-1047" }).title).toBe("Merry Farms: Order MF-1047 is on the way")
  })
  it("keeps one notification per order (same tag), so updates replace each other", () => {
    expect(customerOrderNote("delivered", "ta", { farm: "M", code: "MF-1" }).tag).toBe(customerOrderNote("confirmed", "ta", { farm: "M", code: "MF-1" }).tag)
  })
  it("shortens long messages", () => {
    const n = customerMessageNote("en", "Merry Farms", "x".repeat(300))
    expect(n.body.length).toBe(120)
    expect(n.body.endsWith("…")).toBe(true)
    expect(staffMessageNote("Priya", "c1", "hi")).toMatchObject({ title: "💬 Priya", url: "/farm/messages/c1" })
  })
  it("tells staff about a new order and whether it needs a call", () => {
    expect(staffNewOrderNote({ code: "MF-1048", customerName: "Priya", totalPaise: 39_000, needsCall: true })).toMatchObject({ body: "Priya · ₹390 · அழைக்க / to call", url: "/farm/orders" })
  })
})
