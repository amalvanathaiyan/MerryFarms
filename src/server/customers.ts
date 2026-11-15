import "server-only"
import { randomBytes } from "node:crypto"
import { tenantDb, type TenantDb, type TenantTx } from "@/lib/tenant-db"
import type { Tenant } from "@/lib/tenant"
import { consentChanges, isCustomerKind, STAFF_SOURCES, type ConsentHow, type CustomerKind } from "@/domain/customers"
import { OrderError } from "./orders"
import { phoneProven } from "./people"
import { emailSignInCase } from "@/domain/otp"

/** A long random key: 24 bytes, URL-safe. Unguessable, so it can sit in a personal link. */
const newToken = () => randomBytes(24).toString("base64url")

/** Gives the customer a private key (or a fresh one, which cuts off any old link and phone). */
export async function issueToken(tenantId: string, customerId: string) {
  const token = newToken()
  const r = await tenantDb(tenantId).customer.updateMany({ where: { id: customerId }, data: { accessToken: token, tokenIssuedAt: new Date() } })
  if (r.count !== 1) throw new OrderError("customer_not_found")
  return token
}

/** The customer's key, creating one the first time it's needed (e.g. to send their link). */
export async function ensureToken(tenantId: string, customerId: string) {
  const c = await tenantDb(tenantId).customer.findFirst({ where: { id: customerId }, select: { accessToken: true } })
  if (!c) throw new OrderError("customer_not_found")
  return c.accessToken ?? issueToken(tenantId, customerId)
}

export async function customerByToken(tenantId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null
  return tenantDb(tenantId).customer.findFirst({
    where: { accessToken: token },
    include: { addresses: { orderBy: { createdAt: "desc" }, take: 5 } },
  })
}

export type ConnectResult = { status: "connected"; token: string; customerId: string } | { status: "known" }

/**
 * A visitor (e.g. from the QR code) connects with name and mobile number.
 * A new number becomes a new customer with a key at once. A number the farm already
 * knows is NOT connected by typing it in — otherwise anyone could read that customer's
 * orders and messages; the farm sends them their personal link instead.
 */
export async function connectCustomer(tenant: Tenant, input: { name: string; phone: string; language: "ta" | "en" }): Promise<ConnectResult> {
  const db = tenantDb(tenant.id)
  const existing = await db.customer.findFirst({ where: { phone: input.phone } })
  if (existing) return { status: "known" }
  const token = newToken()
  const c = await db.customer.create({
    data: { tenantId: tenant.id, phone: input.phone, name: input.name, language: input.language, accessToken: token, tokenIssuedAt: new Date(), source: "online" },
  })
  return { status: "connected", token, customerId: c.id }
}

/**
 * Registers a customer whose number was just proven by a sign-in code. If the number is
 * already a customer (e.g. two tabs), signs that customer in instead of making a duplicate.
 */
/**
 * A new customer after a sign-in code. `email` set: they proved that email, not the phone (an email sign-up): the
 * phone stays not checked (no person link, web orders need a call) and the email is theirs for signing in.
 */
export async function registerVerified(
  tenant: Tenant,
  input: { phone: string; name: string; language: "ta" | "en"; offers?: boolean; address?: { line: string; landmark?: string; pincode?: string }; email?: string }
) {
  const db = tenantDb(tenant.id)
  const existing = await db.customer.findFirst({ where: { phone: input.phone }, select: { id: true } })
  if (existing) {
    // Only a proven phone opens a record the farm already has (an email can't: emailSignInCase refuses it earlier).
    if (input.email) throw new OrderError("email_phone_known")
    await phoneProven(tenant.id, existing.id)
    return { customerId: existing.id, token: await ensureToken(tenant.id, existing.id) }
  }
  if (input.email && (await db.customer.findFirst({ where: { email: input.email }, select: { id: true } }))) throw new OrderError("email_in_use")
  const token = newToken()
  const now = new Date()
  const c = await db.customer.create({
    data: {
      tenantId: tenant.id,
      phone: input.phone,
      name: input.name,
      language: input.language,
      accessToken: token,
      tokenIssuedAt: now,
      source: "online",
      marketingOptIn: !!input.offers,
      optInAt: input.offers ? now : null,
      email: input.email ?? null,
      emailVerifiedAt: input.email ? now : null,
    },
  })
  if (input.offers) await db.customerConsent.create({ data: { tenantId: tenant.id, customerId: c.id, channel: "whatsapp", given: true, how: "shop" } })
  if (input.address) {
    await db.address.create({ data: { tenantId: tenant.id, customerId: c.id, line: input.address.line, landmark: input.address.landmark || null, pincode: input.address.pincode || null } })
  }
  if (!input.email) await phoneProven(tenant.id, c.id, now)
  return { customerId: c.id, token }
}

/** What an email code may do for this phone at this farm (src/domain/otp.ts emailSignInCase). */
export async function emailSignIn(tenantId: string, phone: string, email: string) {
  const db = tenantDb(tenantId)
  const [byPhone, byEmail] = await Promise.all([
    db.customer.findFirst({ where: { phone }, select: { id: true, email: true, emailVerifiedAt: true } }),
    db.customer.findFirst({ where: { email }, select: { id: true, phone: true } }),
  ])
  return { case: emailSignInCase(byPhone, byEmail, phone), customerId: byPhone?.id ?? null }
}

/** A signed-in customer whose phone is proven adds (or changes) the email they can sign in with, after its code. */
export async function linkEmail(tenantId: string, customerId: string, email: string, now = new Date()) {
  const db = tenantDb(tenantId)
  const me = await db.customer.findFirst({ where: { id: customerId }, select: { phoneVerifiedAt: true } })
  if (!me) throw new OrderError("customer_not_found")
  if (!me.phoneVerifiedAt) throw new OrderError("phone_not_proven")
  const other = await db.customer.findFirst({ where: { email, NOT: { id: customerId } }, select: { id: true } })
  if (other) throw new OrderError("email_in_use")
  await db.customer.updateMany({ where: { id: customerId }, data: { email, emailVerifiedAt: now } })
}

export async function unlinkEmail(tenantId: string, customerId: string) {
  await tenantDb(tenantId).customer.updateMany({ where: { id: customerId }, data: { email: null, emailVerifiedAt: null } })
}

export interface StaffCustomerForm {
  name: string
  phone: string
  language: "ta" | "en"
  source: StaffSource
  kind: CustomerKind
  whatsappOffers: boolean
  smsOffers: boolean
  /** How the customer agreed to offers, when they did: told staff in person or on the phone. */
  consentHow: "in_person" | "phone"
  address: { line: string; landmark?: string; pincode?: string } | null
}

type StaffSource = (typeof STAFF_SOURCES)[number]

/**
 * Staff add a customer who came in person, by phone or at the market. The number isn't proven: when that person
 * later signs in online with it, they get this record (orders, credit and notes stay together). A number the farm
 * already has is never made twice.
 */
export async function addCustomerByStaff(db: TenantDb, tenantId: string, staffId: string, f: StaffCustomerForm): Promise<{ status: "added" | "exists"; id: string }> {
  if (!(STAFF_SOURCES as readonly string[]).includes(f.source) || !isCustomerKind(f.kind)) throw new OrderError("invalid_form")
  const existing = await db.customer.findFirst({ where: { phone: f.phone }, select: { id: true } })
  if (existing) return { status: "exists", id: existing.id }
  const now = new Date()
  const c = await db.customer.create({
    data: {
      tenantId,
      phone: f.phone,
      name: f.name.trim(),
      language: f.language,
      source: f.source,
      kind: f.kind,
      addedByStaffId: staffId,
      marketingOptIn: f.whatsappOffers,
      optInAt: f.whatsappOffers ? now : null,
      smsOptIn: f.smsOffers,
    },
  })
  const consents = consentChanges({ whatsapp: false, sms: false }, { whatsapp: f.whatsappOffers, sms: f.smsOffers })
  if (consents.length) await db.customerConsent.createMany({ data: consents.map((k) => ({ tenantId, customerId: c.id, ...k, how: f.consentHow, byStaffId: staffId })) })
  if (f.address?.line) {
    await db.address.create({ data: { tenantId, customerId: c.id, line: f.address.line.trim(), landmark: f.address.landmark?.trim() || null, pincode: f.address.pincode || null } })
  }
  return { status: "added", id: c.id }
}

/** Offers changed on the farm's side: the customer told staff. Each change is logged with who and how. */
export async function logConsent(
  db: TenantDb | TenantTx,
  tenantId: string,
  customerId: string,
  before: { whatsapp: boolean; sms: boolean },
  after: { whatsapp: boolean; sms: boolean },
  how: ConsentHow,
  byStaffId: string | null
) {
  const rows = consentChanges(before, after)
  if (rows.length) await db.customerConsent.createMany({ data: rows.map((k) => ({ tenantId, customerId, ...k, how, byStaffId })) })
}
