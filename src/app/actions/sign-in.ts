"use server"

import { cookies } from "next/headers"
import { z } from "zod"
import { requireTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import { normaliseIndianMobile } from "@/domain/phone"
import { getSessionCustomer, rememberCustomer } from "@/lib/customer-session"
import { emailSignIn, ensureToken, linkEmail, registerVerified, unlinkEmail } from "@/server/customers"
import { OrderError } from "@/server/orders"
import { knownPerson, phoneProven } from "@/server/people"
import {
  emailCodes,
  otpOn,
  otpProvider,
  readEmailVerified,
  readVerified,
  requestCode,
  requestEmailCode,
  signEmailVerified,
  signVerified,
  verifyCode,
  verifyEmailCode,
  VERIFIED_COOKIE,
} from "@/server/otp"
import { inboundReady } from "@/server/whatsapp-cloud"
import { checkSignIn, startSignIn } from "@/server/whatsapp-sign-in"
import { normaliseEmail, SIGNED_IN_DAYS } from "@/domain/otp"
import type { Tenant } from "@/lib/tenant"

type Fail = { ok: false; error: string; seconds?: number }

/** Step 1: send a code to the number (any valid number gets one; nothing is revealed). */
export async function sendCodeAction(raw: unknown): Promise<{ ok: true; demoCode?: string } | Fail> {
  const parsed = z.object({ phone: z.string().trim().min(10).max(20), language: z.enum(["ta", "en"]) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "phone_invalid" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  const tenant = await requireTenant()
  if (!otpOn(tenant) || !otpProvider()) return { ok: false, error: "otp_unavailable" }
  return requestCode(tenant, phone, parsed.data.language)
}

const WA_COOKIE = "mf_wa"

/**
 * Step 1, the free way first: when Farm For You's WhatsApp number is set up, the customer sends us the code
 * (`whatsapp`); otherwise we send them one (`code`). `canSendCode`: a code can also be sent to them instead.
 */
export async function startSignInAction(
  raw: unknown
): Promise<
  | { ok: true; way: "whatsapp"; link: string; code: string; number: string; seconds: number; canSendCode: boolean; canEmail: boolean }
  | { ok: true; way: "code"; demoCode?: string; canEmail: boolean }
  | { ok: true; way: "email" }
  | Fail
> {
  const parsed = z.object({ phone: z.string().trim().min(10).max(20), language: z.enum(["ta", "en"]) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "phone_invalid" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  const tenant = await requireTenant()
  if (!otpOn(tenant)) return { ok: false, error: "otp_unavailable" }
  const canEmail = emailCodes() !== null
  if (!inboundReady()) {
    if (!otpProvider()) return { ok: true, way: "email" }
    const r = await requestCode(tenant, phone, parsed.data.language)
    return r.ok ? { ok: true, way: "code", demoCode: r.demoCode, canEmail } : r
  }
  const r = await startSignIn(tenant, phone, parsed.data.language)
  if (!r.ok) return r
  const seconds = Math.round((r.expiresAt.getTime() - Date.now()) / 1000)
  ;(await cookies()).set(WA_COOKIE, `${r.id}.${r.browserKey}`, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: seconds + 60 })
  return { ok: true, way: "whatsapp", link: r.link, code: r.code, number: r.number, seconds, canSendCode: !!otpProvider() && otpProvider() !== "screen", canEmail }
}

/** While the customer is away on WhatsApp: has their message come? Then they're signed in, or go on to register. */
export async function checkWhatsAppAction(): Promise<{ ok: true; next: "waiting" | "done" } | { ok: true; next: "register"; known: { name: string; language: "ta" | "en" } | null } | Fail> {
  const tenant = await requireTenant()
  const jar = await cookies()
  const [id, key] = (jar.get(WA_COOKIE)?.value ?? "").split(".")
  if (!id || !key) return { ok: false, error: "otp_no_code" }
  const r = await checkSignIn(tenant.id, id, key)
  if (r.status === "waiting") return { ok: true, next: "waiting" }
  jar.delete(WA_COOKIE)
  if (r.status === "expired") return { ok: false, error: "otp_expired" }
  if (r.status === "gone") return { ok: false, error: "otp_no_code" }
  return signInProven(tenant, r.phone)
}

/** The number is proven: a customer the farm knows is signed in; a new one goes on to register. */
async function signInProven(tenant: Tenant, phone: string): Promise<{ ok: true; next: "done" } | { ok: true; next: "register"; known: { name: string; language: "ta" | "en" } | null }> {
  const customer = await tenantDb(tenant.id).customer.findFirst({ where: { phone }, select: { id: true } })
  if (customer) {
    await phoneProven(tenant.id, customer.id)
    await rememberCustomer(await ensureToken(tenant.id, customer.id), SIGNED_IN_DAYS)
    return { ok: true, next: "done" }
  }
  ;(await cookies()).set(VERIFIED_COOKIE, signVerified(tenant.id, phone), { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 20 * 60 })
  // New to this farm but known to Farm For You: their name is filled in for them (only they see it).
  return { ok: true, next: "register", known: await knownPerson(phone) }
}

/** Step 2: the code. A known number is signed in; a new one goes on to register. */
export async function checkCodeAction(raw: unknown): Promise<{ ok: true; next: "done" } | { ok: true; next: "register"; known: { name: string; language: "ta" | "en" } | null } | Fail> {
  const parsed = z.object({ phone: z.string().trim(), code: z.string().trim() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "otp_wrong" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  const tenant = await requireTenant()
  if (!otpOn(tenant) || !otpProvider()) return { ok: false, error: "otp_unavailable" }

  const result = await verifyCode(tenant.id, phone, parsed.data.code.replace(/\D/g, ""))
  if (result !== "ok") return { ok: false, error: `otp_${result}` }

  return signInProven(tenant, phone)
}

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  language: z.enum(["ta", "en"]),
  addressLine: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(120).optional(),
  pincode: z.union([z.literal(""), z.string().trim().regex(/^[1-9]\d{5}$/)]).optional(),
  offers: z.boolean().optional(),
})

/** Step 3 (new numbers only): name and, optionally, the delivery address. */
export async function registerAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const tenant = await requireTenant()
  const jar = await cookies()
  const phoneProof = readVerified(tenant.id, jar.get(VERIFIED_COOKIE)?.value)
  const emailProof = phoneProof ? null : readEmailVerified(tenant.id, jar.get(EMAIL_COOKIE)?.value)
  const phone = phoneProof ?? emailProof?.phone ?? null
  if (!phone) return { ok: false, error: "otp_verify_again" }
  const { name, language, addressLine, landmark, pincode, offers } = parsed.data
  let token: string
  try {
    ;({ token } = await registerVerified(tenant, {
      phone,
      email: emailProof?.email,
    name,
    language,
    offers,
      address: addressLine && addressLine.length >= 5 ? { line: addressLine, landmark, pincode: pincode || undefined } : undefined,
    }))
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  await rememberCustomer(token, SIGNED_IN_DAYS)
  jar.delete(VERIFIED_COOKIE)
  jar.delete(EMAIL_COOKIE)
  return { ok: true }
}

// ── Email codes (the phone stays the identity: see emailSignInCase) ─────────────────────────────────────────────

const EMAIL_COOKIE = "mf_ve"
const emailSchema = z.object({ phone: z.string().trim().min(10).max(20), email: z.string().trim().max(120) })

/** Sends a code to the email, for this phone, when an email code may sign this phone in or register it. */
export async function sendEmailCodeAction(raw: unknown): Promise<{ ok: true; demoCode?: string } | Fail> {
  const parsed = emailSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "email_invalid" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  const email = normaliseEmail(parsed.data.email)
  if (!email) return { ok: false, error: "email_invalid" }
  const tenant = await requireTenant()
  if (!otpOn(tenant) || !emailCodes()) return { ok: false, error: "otp_unavailable" }
  const c = await emailSignIn(tenant.id, phone, email)
  if (c.case === "phone_known") return { ok: false, error: "email_phone_known" }
  if (c.case === "email_in_use") return { ok: false, error: "email_in_use" }
  return requestEmailCode(tenant, phone, email)
}

/** The email code: the farm's customer with this phone and email is signed in; a new phone goes on to register. */
export async function checkEmailCodeAction(raw: unknown): Promise<{ ok: true; next: "done" } | { ok: true; next: "register"; known: null } | Fail> {
  const parsed = emailSchema.extend({ code: z.string().trim() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "otp_wrong" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  const email = normaliseEmail(parsed.data.email)
  if (!phone || !email) return { ok: false, error: "otp_wrong" }
  const tenant = await requireTenant()
  if (!otpOn(tenant) || !emailCodes()) return { ok: false, error: "otp_unavailable" }
  const result = await verifyEmailCode(tenant.id, phone, email, parsed.data.code.replace(/\D/g, ""))
  if (result !== "ok") return { ok: false, error: `otp_${result}` }
  const c = await emailSignIn(tenant.id, phone, email)
  if (c.case === "known" && c.customerId) {
    // The email is proven; the phone isn't touched (only a phone proof or the farm's call checks it).
    await rememberCustomer(await ensureToken(tenant.id, c.customerId), SIGNED_IN_DAYS)
    return { ok: true, next: "done" }
  }
  if (c.case !== "new") return { ok: false, error: c.case === "email_in_use" ? "email_in_use" : "email_phone_known" }
  ;(await cookies()).set(EMAIL_COOKIE, signEmailVerified(tenant.id, phone, email), { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 20 * 60 })
  // No name is filled in: an email code doesn't prove the phone, so nothing known about that number is shown.
  return { ok: true, next: "register", known: null }
}

/** A signed-in customer whose phone is proven asks for a code to add this email for signing in. */
export async function sendLinkEmailCodeAction(raw: unknown): Promise<{ ok: true; demoCode?: string } | Fail> {
  const parsed = z.object({ email: z.string().max(120) }).safeParse(raw)
  const email = parsed.success ? normaliseEmail(parsed.data.email) : null
  if (!email) return { ok: false, error: "email_invalid" }
  const tenant = await requireTenant()
  const me = await getSessionCustomer()
  if (!me) return { ok: false, error: "sign_in_needed" }
  if (!me.phoneVerifiedAt) return { ok: false, error: "phone_not_proven" }
  if (!emailCodes()) return { ok: false, error: "otp_unavailable" }
  const c = await emailSignIn(tenant.id, me.phone, email)
  if (c.case === "email_in_use") return { ok: false, error: "email_in_use" }
  return requestEmailCode(tenant, me.phone, email)
}

/** The code from that email: it becomes the customer's email for signing in. */
export async function confirmLinkEmailAction(raw: unknown): Promise<{ ok: true } | Fail> {
  const parsed = z.object({ email: z.string().max(120), code: z.string().trim() }).safeParse(raw)
  const email = parsed.success ? normaliseEmail(parsed.data.email) : null
  if (!parsed.success || !email) return { ok: false, error: "email_invalid" }
  const tenant = await requireTenant()
  const me = await getSessionCustomer()
  if (!me) return { ok: false, error: "sign_in_needed" }
  const result = await verifyEmailCode(tenant.id, me.phone, email, parsed.data.code.replace(/\D/g, ""))
  if (result !== "ok") return { ok: false, error: `otp_${result}` }
  try {
    await linkEmail(tenant.id, me.id, email)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  return { ok: true }
}

export async function removeEmailAction(): Promise<{ ok: true } | Fail> {
  const tenant = await requireTenant()
  const me = await getSessionCustomer()
  if (!me) return { ok: false, error: "sign_in_needed" }
  await unlinkEmail(tenant.id, me.id)
  return { ok: true }
}
