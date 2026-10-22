/**
 * WhatsApp message templates. Every message the farm sends has a Tamil and an English
 * default here; the owner can override any of them in the farm app (WhatsApp page).
 *
 * Placeholders are written {name}. A line whose placeholders all come out empty is
 * dropped, so optional details (like a UPI ID the farm hasn't set) leave no blank line.
 */

export type Lang = "ta" | "en"

export type TemplateKey =
  | "received"
  | "confirmed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "missed_call"
  | "dues"
  | "invoice"
  | "share_shop"
  | "price_list"
  | "personal_link"
  | "new_message"

export interface TemplateDef {
  vars: string[]
  defaults: Record<Lang, string>
}

const ORDER_VARS = ["name", "code", "items", "total", "slot", "payment", "farm"]

export const TEMPLATES: Record<TemplateKey, TemplateDef> = {
  received: {
    vars: ORDER_VARS,
    defaults: {
      ta: "வணக்கம் {name}! உங்கள் ஆர்டர் {code} கிடைத்தது.\n{items}\nமொத்தம் {total}\nஉறுதி செய்ய {farm} உங்களை அழைக்கும்.",
      en: "Hello {name}! We've got your order {code}.\n{items}\nTotal {total}\n{farm} will call you to confirm it.",
    },
  },
  confirmed: {
    vars: ORDER_VARS,
    defaults: {
      ta: "ஆர்டர் {code} உறுதி செய்யப்பட்டது.\nடெலிவரி: {slot}\nமொத்தம் {total} · {payment}",
      en: "Order {code} is confirmed.\nDelivery: {slot}\nTotal {total} · {payment}",
    },
  },
  out_for_delivery: {
    vars: ORDER_VARS,
    defaults: {
      ta: "உங்கள் ஆர்டர் {code} வந்துகொண்டிருக்கிறது. அருகில் வந்ததும் அழைப்போம்.",
      en: "Your order {code} is on the way. We'll call when we're close.",
    },
  },
  delivered: {
    vars: ORDER_VARS,
    defaults: {
      ta: "டெலிவரி முடிந்தது. நன்றி {name}! {farm}",
      en: "Delivered. Thank you, {name}! {farm}",
    },
  },
  cancelled: {
    vars: ORDER_VARS,
    defaults: {
      ta: "மன்னிக்கவும், ஆர்டர் {code} ரத்து செய்யப்பட்டது. கேள்விகள் இருந்தால் இங்கே பதில் அனுப்புங்கள்.",
      en: "Sorry, order {code} has been cancelled. Reply here if you have any questions.",
    },
  },
  missed_call: {
    vars: ORDER_VARS,
    defaults: {
      ta: "வணக்கம் {name}, ஆர்டர் {code} உறுதி செய்ய அழைத்தோம். சிறிது நேரத்தில் மீண்டும் அழைப்போம்.",
      en: "Hello {name}, we called to confirm order {code}. We'll try again shortly.",
    },
  },
  dues: {
    vars: ["name", "farm", "amount", "upi"],
    defaults: {
      ta: "வணக்கம் {name}, {farm} கணக்கில் நிலுவை {amount}.\nUPI: {upi}\nநன்றி!",
      en: "Hello {name}, your balance with {farm} is {amount}.\nUPI: {upi}\nThank you!",
    },
  },
  invoice: {
    vars: ["name", "farm", "number", "amount", "link"],
    defaults: {
      ta: "வணக்கம் {name}, {farm} பில் {number}: {amount}.\n{link}",
      en: "Hello {name}, your {farm} bill {number}: {amount}.\n{link}",
    },
  },
  share_shop: {
    vars: ["farm", "link", "phone"],
    defaults: {
      ta: "வணக்கம்! {farm} — பண்ணையிலிருந்து நேரடியாக உங்கள் வீட்டுக்கு.\nஆர்டர் செய்ய: {link}\nஅழைக்க: {phone}",
      en: "Hello! {farm} — straight from our farm to your door.\nOrder here: {link}\nCall us: {phone}",
    },
  },
  new_message: {
    vars: ["name", "farm", "preview", "link"],
    defaults: {
      ta: "வணக்கம் {name}, {farm}-லிருந்து புதிய செய்தி:\n\"{preview}\"\nபதில் பார்க்க: {link}",
      en: "Hello {name}, a new message from {farm}:\n\"{preview}\"\nSee it here: {link}",
    },
  },
  personal_link: {
    vars: ["name", "farm", "link"],
    defaults: {
      ta: "வணக்கம் {name}! இது {farm}-ல் உங்கள் சொந்த இணைப்பு. இதில் உங்கள் ஆர்டர்கள், பில்கள், மீண்டும் ஆர்டர் செய்தல், பண்ணையுடன் செய்தி எல்லாம் உள்ளன:\n{link}\nஇதை வேறு யாருடனும் பகிர வேண்டாம்.",
      en: "Hello {name}! This is your own link for {farm}: your orders, bills, ordering again and messages to the farm.\n{link}\nPlease don't share it with anyone.",
    },
  },
  price_list: {
    vars: ["farm", "date", "prices", "link", "phone"],
    defaults: {
      ta: "{farm} — இன்றைய விலை ({date})\n{prices}\nஆர்டர் செய்ய: {link}\nஅழைக்க: {phone}",
      en: "{farm} — today's prices ({date})\n{prices}\nOrder here: {link}\nCall us: {phone}",
    },
  },
}

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[]

const PLACEHOLDER = /\{([a-z_]+)\}/g

/** Fills a template. Lines whose placeholders all came out empty are dropped. */
export function fillTemplate(text: string, vars: Record<string, string | undefined>): string {
  return text
    .split("\n")
    .flatMap((line) => {
      // Only known placeholders can make a line "empty"; a misspelt one keeps the line visible.
      const names = [...line.matchAll(PLACEHOLDER)].map((m) => m[1])
      if (names.length > 0 && names.every((n) => n in vars && !vars[n])) return []
      return [line.replace(PLACEHOLDER, (whole, n: string) => (n in vars ? (vars[n] ?? "") : whole))]
    })
    .join("\n")
}

/** Problems with a farm-edited template, or null if it's fine. */
export function checkTemplate(key: TemplateKey, text: string): { unknown: string[] } | "empty" | "too_long" | null {
  if (!text.trim()) return "empty"
  if (text.length > 1000) return "too_long"
  const unknown = [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))].filter((n) => !TEMPLATES[key].vars.includes(n))
  return unknown.length ? { unknown } : null
}

export type TemplateOverrides = Partial<Record<TemplateKey, Partial<Record<Lang, string>>>>

/** The text to use: the farm's own version if set, else the default. */
export function templateText(key: TemplateKey, lang: Lang, overrides: TemplateOverrides = {}): string {
  return overrides[key]?.[lang]?.trim() || TEMPLATES[key].defaults[lang]
}

/** "• நாட்டுக் கோழி முட்டை, 30 முட்டை — ₹390" lines for the price-list message. */
export function priceLines(products: { name: string; pack: string; price: string; soldOut: boolean }[], lang: Lang): string {
  const soldOut = lang === "ta" ? "தீர்ந்துவிட்டது" : "sold out"
  return products.map((p) => `• ${p.name}, ${p.pack} — ${p.soldOut ? soldOut : p.price}`).join("\n")
}
