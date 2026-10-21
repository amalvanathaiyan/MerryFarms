/**
 * WhatsApp Lite mode: the farm sends updates from its own WhatsApp Business app.
 * The farm app prepares the message and opens WhatsApp with it prefilled (one tap to send).
 * No Cloud API, no Meta verification, no per-message cost.
 */
import { formatRupees } from "./money"

export type Lang = "ta" | "en"

/** https://wa.me/919000010001?text=… — opens the chat with the message ready to send. */
export function waMeLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
}

export interface LiteOrderInfo {
  code: string // "MF-1047"
  customerName: string
  farmName: string
  items: { name: string; pack: string; qty: number }[]
  totalPaise: number
  slotText: string // "Tomorrow 7–9 AM" already localised by the caller
  paymentText: string
}

const itemLines = (o: LiteOrderInfo) => o.items.map((i) => `${i.qty} × ${i.name} (${i.pack})`).join("\n")

export type LiteMessageKind = "received" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled" | "missed_call"

/** Bilingual message bodies for each order update. Tamil is plain spoken Tamil. */
export function liteOrderMessage(kind: LiteMessageKind, o: LiteOrderInfo, lang: Lang): string {
  const total = formatRupees(o.totalPaise)
  if (lang === "ta") {
    switch (kind) {
      case "received":
        return `வணக்கம் ${o.customerName}! உங்கள் ஆர்டர் ${o.code} கிடைத்தது.\n${itemLines(o)}\nமொத்தம் ${total}\nஉறுதி செய்ய ${o.farmName} உங்களை அழைக்கும்.`
      case "confirmed":
        return `ஆர்டர் ${o.code} உறுதி செய்யப்பட்டது.\nடெலிவரி: ${o.slotText}\nமொத்தம் ${total} · ${o.paymentText}`
      case "out_for_delivery":
        return `உங்கள் ஆர்டர் ${o.code} வந்துகொண்டிருக்கிறது. அருகில் வந்ததும் அழைப்போம்.`
      case "delivered":
        return `டெலிவரி முடிந்தது. நன்றி ${o.customerName}! ${o.farmName}`
      case "cancelled":
        return `மன்னிக்கவும், ஆர்டர் ${o.code} ரத்து செய்யப்பட்டது. கேள்விகள் இருந்தால் இங்கே பதில் அனுப்புங்கள்.`
      case "missed_call":
        return `வணக்கம் ${o.customerName}, ஆர்டர் ${o.code} உறுதி செய்ய அழைத்தோம். சிறிது நேரத்தில் மீண்டும் அழைப்போம்.`
    }
  }
  switch (kind) {
    case "received":
      return `Hello ${o.customerName}! We've got your order ${o.code}.\n${itemLines(o)}\nTotal ${total}\n${o.farmName} will call you to confirm it.`
    case "confirmed":
      return `Order ${o.code} is confirmed.\nDelivery: ${o.slotText}\nTotal ${total} · ${o.paymentText}`
    case "out_for_delivery":
      return `Your order ${o.code} is on the way. We'll call when we're close.`
    case "delivered":
      return `Delivered. Thank you, ${o.customerName}! ${o.farmName}`
    case "cancelled":
      return `Sorry, order ${o.code} has been cancelled. Reply here if you have any questions.`
    case "missed_call":
      return `Hello ${o.customerName}, we called to confirm order ${o.code}. We'll try again shortly.`
  }
}
