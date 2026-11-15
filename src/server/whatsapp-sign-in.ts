import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"
import type { Tenant } from "@/lib/tenant"
import { normaliseIndianMobile } from "@/domain/phone"
import { canSend, codeFromMessage, hashCode, inboundText, INBOUND_TTL_MS, newCode, sameHash, waLink } from "@/domain/otp"
import { secret } from "./otp"
import { replyText } from "./whatsapp-cloud"

/**
 * Free sign-in (docs/whatsapp-setup.md): the shop shows a code and a "Send code on WhatsApp" button; the customer sends
 * it to Farm For You's number; the webhook sees a message from that number with the right code and marks the request
 * proven; the browser that started it (and only that one, by its secret) is then signed in.
 * Messages people send to a business cost nothing, and WhatsApp vouches for the sender's number.
 */

const sha = (s: string) => createHash("sha256").update(s).digest("hex")

export type StartResult =
  | { ok: true; id: string; browserKey: string; code: string; link: string; number: string; expiresAt: Date }
  | { ok: false; error: "otp_wait"; seconds: number }
  | { ok: false; error: "otp_too_many" }

/** A new request for this number. Limited like sent codes (one number, every farm: one WhatsApp number for all). */
export async function startSignIn(tenant: Pick<Tenant, "id">, phone: string, lang: "ta" | "en", now = new Date()): Promise<StartResult> {
  const recent = await prisma.whatsAppSignIn.findMany({ where: { phone, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) } }, select: { createdAt: true } })
  const check = canSend(recent.map((r) => r.createdAt), now)
  if (!check.ok) return check.reason === "wait" ? { ok: false, error: "otp_wait", seconds: check.seconds } : { ok: false, error: "otp_too_many" }
  const code = newCode()
  const browserKey = randomBytes(24).toString("base64url")
  const expiresAt = new Date(now.getTime() + INBOUND_TTL_MS)
  const row = await tenantDb(tenant.id).whatsAppSignIn.create({
    data: { tenantId: tenant.id, phone, language: lang, codeHash: hashCode(secret(), tenant.id, phone, code), browserHash: sha(browserKey), expiresAt, createdAt: now },
  })
  const number = (process.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, "")
  return { ok: true, id: row.id, browserKey, code, number, link: waLink(number, inboundText(code, lang)), expiresAt }
}

export type Received = "proven" | "repeat" | "no_match" | "no_code" | "not_indian"

/**
 * A message to Farm For You's number. `from` is WhatsApp's own record of the sender ("919876543210"). The newest
 * waiting request from that number with that code is proven; a repeat of the same message (Meta retries) changes nothing.
 */
export async function receiveMessage(from: string, text: string, now = new Date()): Promise<{ result: Received; tenantId?: string; language?: "ta" | "en" }> {
  const phone = normaliseIndianMobile(from)
  if (!phone) return { result: "not_indian" }
  const code = codeFromMessage(text)
  if (!code) return { result: "no_code" }
  const rows = await prisma.whatsAppSignIn.findMany({
    where: { phone, createdAt: { gte: new Date(now.getTime() - 2 * INBOUND_TTL_MS) } },
    orderBy: { createdAt: "desc" },
  })
  const match = rows.find((r) => sameHash(r.codeHash, hashCode(secret(), r.tenantId, phone, code)))
  if (!match) return { result: "no_match" }
  if (match.provenAt) return { result: "repeat", tenantId: match.tenantId, language: match.language }
  if (match.usedAt || match.expiresAt.getTime() <= now.getTime()) return { result: "no_match" }
  await prisma.whatsAppSignIn.updateMany({ where: { id: match.id, provenAt: null }, data: { provenAt: now } })
  return { result: "proven", tenantId: match.tenantId, language: match.language }
}

/** What the customer is told on WhatsApp after their message (Tamil first, then English). */
export async function replyTo(from: string, r: { result: Received; tenantId?: string }) {
  if (r.result === "repeat" || r.result === "not_indian") return
  let body: string
  if (r.result === "proven") {
    const t = await prisma.tenant.findUnique({ where: { id: r.tenantId! }, select: { nameTa: true, nameEn: true, phone: true } })
    body =
      `✅ ${t?.nameTa ?? "Farm For You"}: எண் உறுதியானது. கடைக்குத் திரும்புங்கள், தானாக உள்நுழைவீர்கள்.\n` +
      `✅ ${t?.nameEn ?? "Farm For You"}: number confirmed. Go back to the shop; you'll be signed in by itself.` +
      (t?.phone ? `\n\nநீங்கள் கேட்கவில்லையா? / Not you? ${t.phone}` : "")
  } else if (r.result === "no_match") {
    body =
      "இந்தக் குறியீடு பொருந்தவில்லை அல்லது நேரம் முடிந்தது. கடையில் மீண்டும் தொடங்கவும்.\n" +
      "This code doesn't match or has run out of time. Please start again in the shop."
  } else {
    body =
      "இந்த எண் உள்நுழைவுக் குறியீட்டுக்கு மட்டும். ஆர்டர் செய்ய அல்லது கேட்க, பண்ணையை அழைக்கவும்.\n" +
      "This number is only for sign-in codes. To order or ask anything, please contact the farm."
  }
  await replyText(from, body)
}

export type CheckResult = { status: "proven"; phone: string } | { status: "waiting" } | { status: "expired" } | { status: "gone" }

/** The browser that started the request asks whether the message came. A proof is used once. */
export async function checkSignIn(tenantId: string, id: string, browserKey: string, now = new Date()): Promise<CheckResult> {
  const db = tenantDb(tenantId)
  const row = await db.whatsAppSignIn.findFirst({ where: { id } })
  if (!row || !sameHash(row.browserHash, sha(browserKey)) || row.usedAt) return { status: "gone" }
  if (row.provenAt) {
    const { count } = await db.whatsAppSignIn.updateMany({ where: { id, usedAt: null }, data: { usedAt: now } })
    return count === 1 ? { status: "proven", phone: row.phone } : { status: "gone" }
  }
  return row.expiresAt.getTime() <= now.getTime() ? { status: "expired" } : { status: "waiting" }
}

/** Old requests are useless after a day; keeps the table small. */
export async function pruneSignIns(now = new Date()) {
  await prisma.whatsAppSignIn.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 24 * 3600_000) } } })
}
