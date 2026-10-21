import { describe, expect, it } from "vitest"
import { checkTemplate, fillTemplate, priceLines, TEMPLATE_KEYS, TEMPLATES, templateText } from "./templates"
import { liteOrderMessage, waShareLink } from "./whatsapp-lite"

describe("message templates", () => {
  it("fills placeholders and drops lines whose details are empty", () => {
    const text = TEMPLATES.dues.defaults.ta
    const withUpi = fillTemplate(text, { name: "பிரியா", farm: "மெர்ரி ஃபார்ம்ஸ்", amount: "₹390", upi: "mf@okaxis" })
    expect(withUpi).toContain("UPI: mf@okaxis")
    const noUpi = fillTemplate(text, { name: "பிரியா", farm: "மெர்ரி ஃபார்ம்ஸ்", amount: "₹390", upi: "" })
    expect(noUpi).not.toContain("UPI")
    expect(noUpi.split("\n")).toHaveLength(2)
  })

  it("keeps unknown placeholders visible instead of silently deleting them", () => {
    expect(fillTemplate("Hi {nmae}", { name: "Priya" })).toBe("Hi {nmae}")
  })

  it("uses the farm's own text when set, otherwise the default", () => {
    expect(templateText("delivered", "ta")).toBe(TEMPLATES.delivered.defaults.ta)
    expect(templateText("delivered", "ta", { delivered: { ta: "நன்றி {name}!" } })).toBe("நன்றி {name}!")
    expect(templateText("delivered", "en", { delivered: { ta: "நன்றி" } })).toBe(TEMPLATES.delivered.defaults.en)
    expect(templateText("delivered", "ta", { delivered: { ta: "   " } })).toBe(TEMPLATES.delivered.defaults.ta)
  })

  it("checks a farm-edited template", () => {
    expect(checkTemplate("delivered", "நன்றி {name}!")).toBeNull()
    expect(checkTemplate("delivered", "நன்றி {nmae}!")).toEqual({ unknown: ["nmae"] })
    expect(checkTemplate("delivered", "  ")).toBe("empty")
    expect(checkTemplate("delivered", "x".repeat(1001))).toBe("too_long")
  })

  it("has a default in both languages for every template, using only its own placeholders", () => {
    for (const k of TEMPLATE_KEYS) {
      for (const lang of ["ta", "en"] as const) expect(checkTemplate(k, TEMPLATES[k].defaults[lang])).toBeNull()
    }
  })

  it("applies the farm's template to order messages", () => {
    const o = { code: "MF-1047", customerName: "Priya", farmName: "Merry Farms", items: [{ name: "Eggs", pack: "30", qty: 2 }], totalPaise: 78_000, slotText: "Tomorrow 7–9 AM", paymentText: "UPI" }
    expect(liteOrderMessage("confirmed", o, "en", { confirmed: { en: "{code} OK for {slot}, {total}" } })).toBe("MF-1047 OK for Tomorrow 7–9 AM, ₹780")
  })

  it("builds a price list, marking sold-out items", () => {
    const lines = priceLines([{ name: "முட்டை", pack: "30", price: "₹390", soldOut: false }, { name: "கோழி", pack: "1 கிலோ", price: "₹680", soldOut: true }], "ta")
    expect(lines).toBe("• முட்டை, 30 — ₹390\n• கோழி, 1 கிலோ — தீர்ந்துவிட்டது")
  })

  it("builds a share link without a phone number", () => {
    expect(waShareLink("வணக்கம் & hi")).toBe(`https://wa.me/?text=${encodeURIComponent("வணக்கம் & hi")}`)
  })
})
