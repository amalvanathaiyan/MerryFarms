import { cache } from "react"
import { cookies } from "next/headers"
import { getTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { customerByToken } from "@/server/customers"

/** Cookie holding the customer's private key on their phone (no login, no password). */
export const CUSTOMER_COOKIE = "mf_c"
export const CUSTOMER_COOKIE_OPTIONS = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365 }

/** The customer this phone belongs to, for the farm being viewed, or null. */
export const getSessionCustomer = cache(async () => {
  const tenant = await getTenant()
  if (!tenant || !featuresOf(tenant).customerAccounts) return null
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value
  if (!token) return null
  return customerByToken(tenant.id, token)
})

/** Remember this phone as the customer's. Only from server actions and route handlers. */
export async function rememberCustomer(token: string) {
  ;(await cookies()).set(CUSTOMER_COOKIE, token, CUSTOMER_COOKIE_OPTIONS)
}

export async function forgetCustomer() {
  ;(await cookies()).delete(CUSTOMER_COOKIE)
}
