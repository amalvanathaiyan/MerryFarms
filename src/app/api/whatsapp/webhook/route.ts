import { NextResponse } from "next/server"
import { receiveMessage, replyTo } from "@/server/whatsapp-sign-in"
import { signedByMeta } from "@/server/whatsapp-cloud"

/**
 * Farm For You's WhatsApp number calls this (docs/whatsapp-setup.md, step 8).
 * GET: Meta checks the address once, with WHATSAPP_VERIFY_TOKEN.
 * POST: messages people send us, signed with WHATSAPP_APP_SECRET; sign-in codes are matched (src/server/whatsapp-sign-in.ts).
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const token = process.env.WHATSAPP_VERIFY_TOKEN
  if (token && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === token) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } })
  }
  return new NextResponse("forbidden", { status: 403 })
}

type Incoming = { from?: string; type?: string; text?: { body?: string } }
type Payload = { entry?: { changes?: { value?: { messages?: Incoming[] } }[] }[] }

export async function POST(request: Request) {
  const raw = await request.text()
  if (!signedByMeta(raw, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let payload: Payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: true })
  }
  const messages = (payload.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []))
  for (const m of messages) {
    if (!m.from) continue
    try {
      const r = await receiveMessage(m.from, m.type === "text" ? (m.text?.body ?? "") : "")
      await replyTo(m.from, r)
    } catch (e) {
      console.error("[whatsapp webhook]", (e as Error).message)
    }
  }
  // Always 200 once signed: Meta retries anything else for days.
  return NextResponse.json({ ok: true })
}
