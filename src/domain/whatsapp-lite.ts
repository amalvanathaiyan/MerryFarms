/**
 * WhatsApp Lite mode: the farm sends updates from its own WhatsApp Business app.
 * The farm app prepares the message and opens WhatsApp with it prefilled (one tap to send).
 * No Cloud API, no Meta verification, no per-message cost.
 */
import { formatRupees } from "./money"
import { fillTemplate, templateText, type Lang, type TemplateOverrides } from "./templates"

export type { Lang }

/** https://wa.me/919000010001?text=… — opens the chat with the message ready to send. */
export function waMeLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
}

/** https://wa.me/?text=… — WhatsApp asks who to send it to (a customer, a group, Status). */
export function waShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
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

export type LiteMessageKind = "received" | "confirmed" | "out_for_delivery" | "delivered" | "cancelled" | "missed_call"

/** The order update message, from the farm's own template or the default. */
export function liteOrderMessage(kind: LiteMessageKind, o: LiteOrderInfo, lang: Lang, overrides?: TemplateOverrides): string {
  return fillTemplate(templateText(kind, lang, overrides), {
    name: o.customerName,
    code: o.code,
    items: o.items.map((i) => `${i.qty} × ${i.name} (${i.pack})`).join("\n"),
    total: formatRupees(o.totalPaise),
    slot: o.slotText,
    payment: o.paymentText,
    farm: o.farmName,
  })
}
