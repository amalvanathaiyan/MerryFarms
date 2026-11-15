/**
 * One-time codes for customer sign-in by mobile number. Pure rules; the server stores a
 * keyed hash of each code (never the digits) and sends it by WhatsApp or SMS.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto"

export const CODE_LENGTH = 6
export const CODE_TTL_MS = 5 * 60_000
export const MAX_ATTEMPTS = 5
/** Wait before asking for another code, then at most this many per number per hour / day. */
export const RESEND_AFTER_MS = 30_000
export const MAX_PER_HOUR = 4
export const MAX_PER_DAY = 8

export function newCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0")
}

/** Tied to the farm and number, so a code for one never works for another. */
export function hashCode(secret: string, tenantId: string, phone: string, code: string): string {
  return createHmac("sha256", secret).update(`${tenantId}|${phone}|${code}`).digest("hex")
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex")
  const y = Buffer.from(b, "hex")
  return x.length === y.length && timingSafeEqual(x, y)
}

export type SendCheck = { ok: true } | { ok: false; reason: "wait"; seconds: number } | { ok: false; reason: "too_many" }

/** May another code be sent to this number now? `sentAt`: earlier codes for it. */
export function canSend(sentAt: Date[], now: Date): SendCheck {
  const t = now.getTime()
  const ages = sentAt.map((d) => t - d.getTime()).filter((a) => a >= 0)
  if (ages.filter((a) => a < 24 * 3600_000).length >= MAX_PER_DAY) return { ok: false, reason: "too_many" }
  if (ages.filter((a) => a < 3600_000).length >= MAX_PER_HOUR) return { ok: false, reason: "too_many" }
  const newest = Math.min(...ages, Infinity)
  if (newest < RESEND_AFTER_MS) return { ok: false, reason: "wait", seconds: Math.ceil((RESEND_AFTER_MS - newest) / 1000) }
  return { ok: true }
}

export type CheckResult = "ok" | "wrong" | "expired" | "too_many_tries" | "no_code"

/** Checks a typed code against the latest one sent (before counting this attempt). */
export function checkCode(
  latest: { codeHash: string; expiresAt: Date; attempts: number; usedAt: Date | null } | null,
  typedHash: string,
  now: Date
): CheckResult {
  if (!latest || latest.usedAt) return "no_code"
  if (latest.attempts >= MAX_ATTEMPTS) return "too_many_tries"
  if (latest.expiresAt.getTime() <= now.getTime()) return "expired"
  return sameHash(latest.codeHash, typedHash) ? "ok" : "wrong"
}

// ── Free sign-in: the customer sends the code to us on WhatsApp ────────────────────────────────────────────────

/** Time to send the message and come back. */
export const INBOUND_TTL_MS = 10 * 60_000
/** Signed in on that phone for this long after a code sign-in (until sign-out sooner). */
export const SIGNED_IN_DAYS = 90

/** The ready-made message: the code, with words the customer recognises. */
export function inboundText(code: string, lang: "ta" | "en") {
  return lang === "en" ? `Farm For You sign-in code ${code}` : `Farm For You உள்நுழைவுக் குறியீடு ${code}`
}

/** The 6-digit code in a message the customer sent (they may have typed it, or added words). */
export function codeFromMessage(text: string): string | null {
  const m = /(?:^|\D)(\d{6})(?!\d)/.exec(text.normalize("NFKC"))
  return m ? m[1] : null
}

/** Opens WhatsApp with the message ready, addressed to Farm For You's number (digits, with country code). */
export function waLink(number: string, text: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
}
