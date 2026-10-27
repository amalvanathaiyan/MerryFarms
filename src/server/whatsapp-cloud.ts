import "server-only"

/**
 * FarmForYou's own WhatsApp Business number (Meta Cloud API), shared by every farm for
 * sign-in codes and alerts to farms. Set WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID;
 * each message type is a template approved in Meta's WhatsApp Manager.
 */
export function cloudConfigured() {
  return !!process.env.WHATSAPP_API_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID
}

export type Template = { name: string; lang: "ta" | "en"; body: string[]; urlButton?: string }
type Sender = (to: string, t: Template) => Promise<void>

let sender: Sender = async (to, t) => {
  const components: object[] = [{ type: "body", parameters: t.body.map((text) => ({ type: "text", text })) }]
  if (t.urlButton) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: t.urlButton }] })
  const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: { name: t.name, language: { code: t.lang }, components },
    }),
  })
  if (!res.ok) throw new Error(`whatsapp ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

export function sendTemplate(to: string, t: Template) {
  return sender(to, t)
}

export function setWhatsAppSenderForTests(s: Sender) {
  sender = s
}
