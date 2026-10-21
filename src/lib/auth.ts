import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSSRClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "@/lib/demo-auth"
import type { StaffRole } from "@prisma/client"

/** The auth user id of whoever is signed in: Supabase, or a demo staff member in demo mode. */
async function currentAuthUserId(): Promise<string | null> {
  if (isDemoLoginEnabled()) {
    const demoId = (await cookies()).get(DEMO_COOKIE)?.value
    if (demoId?.startsWith(DEMO_AUTH_PREFIX)) return demoId
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * The signed-in staff member of THIS farm, or a redirect to /login.
 * A login that belongs to another farm gets no access here.
 */
export const requireStaff = cache(async (allowed?: StaffRole[]) => {
  const tenant = await requireTenant()
  const authUserId = await currentAuthUserId()
  if (!authUserId) redirect("/login")

  const db = tenantDb(tenant.id)
  const staff = await db.staffMember.findFirst({ where: { authUserId, isActive: true } })
  if (!staff) redirect("/login?error=not_staff")
  if (allowed && !staff.roles.some((r) => allowed.includes(r))) redirect("/farm?error=access_denied")

  return { tenant, staff, db }
})

export const OWNER_ONLY: StaffRole[] = ["owner"]
export const ORDER_DESK: StaffRole[] = ["owner", "order_desk"]
