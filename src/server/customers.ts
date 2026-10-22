import "server-only"
import { randomBytes } from "node:crypto"
import { tenantDb } from "@/lib/tenant-db"
import type { Tenant } from "@/lib/tenant"
import { OrderError } from "./orders"

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
    data: { tenantId: tenant.id, phone: input.phone, name: input.name, language: input.language, accessToken: token, tokenIssuedAt: new Date() },
  })
  return { status: "connected", token, customerId: c.id }
}
