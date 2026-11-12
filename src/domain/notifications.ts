/**
 * Phone-notification wording. Short: a phone shows about 40 characters of title and
 * two lines of body. Customer notifications use the customer's language; staff ones
 * use Tamil and English together.
 */
import { formatRupees } from "./money"

export type Lang = "ta" | "en"

export interface Note {
  title: string
  body: string
  url: string
  /** Same tag replaces an older notification instead of stacking (e.g. one per order). */
  tag?: string
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function customerOrderNote(kind: "confirmed" | "out_for_delivery" | "delivered" | "cancelled", lang: Lang, o: { farm: string; code: string; slotText?: string; totalPaise?: number }): Note {
  const ta: Record<typeof kind, [string, string]> = {
    confirmed: [`ஆர்டர் ${o.code} உறுதி`, `${o.slotText ?? ""}${o.totalPaise != null ? ` · ${formatRupees(o.totalPaise)}` : ""}`],
    out_for_delivery: [`ஆர்டர் ${o.code} வழியில்`, "அருகில் வந்ததும் அழைப்போம்."],
    delivered: [`ஆர்டர் ${o.code} டெலிவரி ஆனது`, "நன்றி! பில் 'என் ஆர்டர்கள்' பக்கத்தில் உள்ளது."],
    cancelled: [`ஆர்டர் ${o.code} ரத்து`, "கேள்விகள் இருந்தால் பண்ணைக்கு செய்தி அனுப்புங்கள்."],
  }
  const en: Record<typeof kind, [string, string]> = {
    confirmed: [`Order ${o.code} confirmed`, `${o.slotText ?? ""}${o.totalPaise != null ? ` · ${formatRupees(o.totalPaise)}` : ""}`],
    out_for_delivery: [`Order ${o.code} is on the way`, "We'll call when we're close."],
    delivered: [`Order ${o.code} delivered`, "Thank you! Your bill is on your My orders page."],
    cancelled: [`Order ${o.code} cancelled`, "Message the farm if you have any questions."],
  }
  const [title, body] = (lang === "ta" ? ta : en)[kind]
  return { title: `${o.farm}: ${title}`, body: body.replace(/^ · /, ""), url: "/my", tag: `order-${o.code}` }
}

export function customerMessageNote(lang: Lang, farm: string, text: string): Note {
  return { title: lang === "ta" ? `${farm}: புதிய செய்தி` : `${farm}: new message`, body: clip(text, 120), url: "/my/messages", tag: "messages" }
}

export function staffMessageNote(customerName: string, customerId: string, text: string): Note {
  return { title: `💬 ${customerName}`, body: clip(text, 120), url: `/farm/messages/${customerId}`, tag: `chat-${customerId}` }
}

export function staffNewOrderNote(o: { code: string; customerName: string; totalPaise: number; needsCall: boolean }): Note {
  return {
    title: `புதிய ஆர்டர் · New order ${o.code}`,
    body: `${o.customerName} · ${formatRupees(o.totalPaise)}${o.needsCall ? " · அழைக்க / to call" : ""}`,
    url: o.needsCall ? "/farm/orders" : "/farm/orders?tab=open",
    tag: `new-${o.code}`,
  }
}

// ── Poultry reminders (staff: Tamil and English together) ─────────────────────

const names = (xs: string[]) => clip(xs.join(", "), 80)

/** Evening: batches with nothing entered for today. */
export function staffNotEnteredNote(batchNames: string[]): Note {
  const n = batchNames.length
  return {
    title: `இன்றைய பதிவு இல்லை · ${n === 1 ? "1 batch not entered" : `${n} batches not entered`}`,
    body: `${names(batchNames)} · இப்போதே பதியுங்கள் / enter it now`,
    url: "/farm/poultry/today",
    tag: "not-entered",
  }
}

/** Morning: vaccine doses due today or late. */
export function staffVaccinesDueNote(doses: { vaccine: string; batchName: string; late: boolean }[]): Note {
  const n = doses.length
  const late = doses.some((d) => d.late)
  return {
    title: `தடுப்பூசி · ${n === 1 ? "1 vaccine due" : `${n} vaccines due`}${late ? " · தாமதம் / late" : ""}`,
    body: names(doses.map((d) => `${d.vaccine} (${d.batchName})`)),
    url: "/farm/poultry/vaccines",
    tag: "vaccines-due",
  }
}

/** Morning: warnings worked out from the entries (unusual losses, feed running out, eggs dropping). */
export function staffWarningsNote(lines: { ta: string; en: string }[]): Note {
  return {
    title: `கவனிக்கவும் · ${lines.length === 1 ? "1 thing to check" : `${lines.length} things to check`}`,
    body: clip(lines.map((l) => `${l.ta} / ${l.en}`).join(" · "), 160),
    url: "/farm",
    tag: "warnings",
  }
}

/** Automation (orderWaiting): orders still not confirmed after the farm's red mark. */
export function staffOrdersWaitingNote(codes: string[], redHours: number): Note {
  const n = codes.length
  return {
    title: `கவனிக்கவும் · ${n === 1 ? "1 order waiting" : `${n} orders waiting`} ${redHours}+ h`,
    body: `${redHours} மணி நேரத்துக்கு மேல் உறுதி செய்யப்படவில்லை / Not confirmed for over ${redHours} h: ${names(codes)}`,
    url: "/farm/orders",
    tag: "orders-waiting",
  }
}

/** Automation (lowStock): products down to the farm's mark. */
export function staffLowStockNote(products: string[]): Note {
  return {
    title: `இருப்பு குறைவு · ${products.length === 1 ? "1 product low" : `${products.length} products low`}`,
    body: names(products),
    url: "/farm/catalogue",
    tag: "low-stock",
  }
}

/** Automation (trialEnding): the farm's free trial ends soon. */
export function ownerTrialEndingNote(days: number, date: string): Note {
  return {
    title: `Farm For You · ${days === 1 ? "இலவச சோதனை நாளை முடிகிறது / Trial ends tomorrow" : `இலவச சோதனை ${days} நாளில் முடிகிறது / Trial ends in ${days} days`}`,
    body: `${date} · திட்டம் பற்றி அமைப்புகள் → திட்டம் / See Settings → Plan`,
    url: "/farm/settings/plan",
    tag: "trial-ending",
  }
}
