import { NextResponse } from "next/server"
import { requireTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { CUSTOMER_COOKIE, CUSTOMER_COOKIE_OPTIONS } from "@/lib/customer-session"
import { customerByToken } from "@/server/customers"

/**
 * A customer's personal link (sent by the farm). Remembers them on this phone and
 * opens "My orders". The token itself is the proof; a reset token stops working.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tenant = await requireTenant()
  const url = new URL(request.url)
  const ok = featuresOf(tenant).customerAccounts && (await customerByToken(tenant.id, token))
  const res = NextResponse.redirect(new URL(ok ? "/my" : "/my?link=expired", url.origin))
  // Never keep the key in the browser's history beyond this redirect.
  res.headers.set("Referrer-Policy", "no-referrer")
  if (ok) res.cookies.set(CUSTOMER_COOKIE, token, CUSTOMER_COOKIE_OPTIONS)
  return res
}
