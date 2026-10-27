import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"
import { featuresOf } from "@/lib/features"
import type { Tenant } from "@/lib/tenant"
import { sendTemplate } from "./whatsapp-cloud"
import { canSend, checkCode, CODE_TTL_MS, hashCode, newCode, type CheckResult } from "@/domain/otp"

/**
 * Who delivers sign-in codes. Set once for the whole platform:
 *   OTP_PROVIDER=whatsapp  WhatsApp Cloud API "authentication" template (see whatsapp-cloud.ts;
 *                          template name in WHATSAPP_OTP_TEMPLATE)
 *   OTP_PROVIDER=msg91     SMS via MSG91, DLT-approved template (MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID)
 * With no provider, the local demo and dev server show the code on screen instead; a live
 * site without one keeps the older sign-in (personal links), so nothing breaks.
 */
type Provider = "whatsapp" | "msg91" | "screen"

export function otpProvider(): Provider | null {
  const p = process.env.OTP_PROVIDER
  if (p === "whatsapp" || p === "msg91") return p
  if (process.env.NODE_ENV !== "production" || process.env.DEMO_LOGIN === "1") return "screen"
  return null
}

function secret() {
  const s = process.env.OTP_SECRET
  if (s && s.length >= 32) return s
  if (otpProvider() === "screen") return "farmforyou-local-demo-only-otp-secret"
  throw new Error("OTP_SECRET (32+ characters) is required to send sign-in codes")
}

/** Code sign-in is in use for this farm: switched on and a way to send codes exists. */
export function otpOn(tenant: Tenant) {
  return featuresOf(tenant).otpLogin && otpProvider() !== null
}

type Send = (phone: string, code: string, lang: "ta" | "en") => Promise<void>

const senders: Record<Exclude<Provider, "screen">, Send> = {
  async whatsapp(phone, code, lang) {
    await sendTemplate(phone, { name: process.env.WHATSAPP_OTP_TEMPLATE ?? "sign_in_code", lang, body: [code], urlButton: code })
  },
  async msg91(phone, code) {
    const url = new URL("https://control.msg91.com/api/v5/otp")
    url.searchParams.set("template_id", process.env.MSG91_OTP_TEMPLATE_ID ?? "")
    url.searchParams.set("mobile", phone.replace(/^\+/, ""))
    url.searchParams.set("otp", code)
    const res = await fetch(url, { method: "POST", headers: { authkey: process.env.MSG91_AUTH_KEY ?? "" } })
    if (!res.ok) throw new Error(`msg91 ${res.status}`)
  },
}

let sendForTests: Send | null = null
export function setOtpSenderForTests(s: Send | null) {
  sendForTests = s
}

export type RequestResult = { ok: true; demoCode?: string } | { ok: false; error: "otp_wait"; seconds: number } | { ok: false; error: "otp_too_many" | "otp_unavailable" | "otp_send_failed" }

/** Sends a code to any valid number, registered or not, so the reply reveals nothing. */
export async function requestCode(tenant: Tenant, phone: string, lang: "ta" | "en", now = new Date()): Promise<RequestResult> {
  const provider = otpProvider()
  if (!provider) return { ok: false, error: "otp_unavailable" }
  const db = tenantDb(tenant.id)
  const recent = await db.otpCode.findMany({ where: { phone, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) } }, select: { createdAt: true } })
  const check = canSend(recent.map((r) => r.createdAt), now)
  if (!check.ok) return check.reason === "wait" ? { ok: false, error: "otp_wait", seconds: check.seconds } : { ok: false, error: "otp_too_many" }

  const code = newCode()
  await db.otpCode.create({ data: { tenantId: tenant.id, phone, codeHash: hashCode(secret(), tenant.id, phone, code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), createdAt: now } })
  if (provider === "screen" && !sendForTests) return { ok: true, demoCode: code }
  try {
    await (sendForTests ?? senders[provider as Exclude<Provider, "screen">])(phone, code, lang)
  } catch (e) {
    console.error("[otp] send failed:", (e as Error).message)
    return { ok: false, error: "otp_send_failed" }
  }
  return { ok: true }
}

/** Checks the latest code for the number; counts the attempt; a right code can't be reused. */
export async function verifyCode(tenantId: string, phone: string, code: string, now = new Date()): Promise<CheckResult> {
  if (!/^\d{6}$/.test(code)) return "wrong"
  const db = tenantDb(tenantId)
  const latest = await db.otpCode.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } })
  const result = checkCode(latest, hashCode(secret(), tenantId, phone, code), now)
  if (latest && (result === "ok" || result === "wrong")) {
    await db.otpCode.updateMany({ where: { id: latest.id }, data: result === "ok" ? { usedAt: now } : { attempts: { increment: 1 } } })
  }
  return result
}

// ── "This number was just verified" between the code and the registration form ──────────

export const VERIFIED_COOKIE = "mf_vp"
const VERIFIED_TTL_MS = 20 * 60_000

/** A short-lived, signed note that this phone proved the number (for registering). */
export function signVerified(tenantId: string, phone: string, now = new Date()) {
  const body = `${tenantId}|${phone}|${now.getTime() + VERIFIED_TTL_MS}`
  return `${Buffer.from(body).toString("base64url")}.${createHmac("sha256", secret()).update(body).digest("base64url")}`
}

export function readVerified(tenantId: string, value: string | undefined, now = new Date()): string | null {
  if (!value) return null
  const [b, sig] = value.split(".")
  if (!b || !sig) return null
  const body = Buffer.from(b, "base64url").toString()
  const expected = createHmac("sha256", secret()).update(body).digest("base64url")
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null
  const [t, phone, exp] = body.split("|")
  return t === tenantId && Number(exp) > now.getTime() ? phone : null
}

/** Old codes are useless after a day; keeps the table small. */
export async function pruneCodes(now = new Date()) {
  await prisma.otpCode.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 2 * 24 * 3600_000) } } })
}
