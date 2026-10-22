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
