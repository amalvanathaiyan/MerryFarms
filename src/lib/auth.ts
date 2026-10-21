import { cache } from "react"
import { redirect } from "next/navigation"
import { createSSRClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import type { StaffRole } from "@prisma/client"

/**
 * The signed-in staff member of THIS farm, or a redirect to /login.
 * A login that belongs to another farm gets no access here.
 */
export const requireStaff = cache(async (allowed?: StaffRole[]) => {
  const tenant = await requireTenant()
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const db = tenantDb(tenant.id)
  const staff = await db.staffMember.findFirst({ where: { authUserId: user.id, isActive: true } })
  if (!staff) redirect("/login?error=not_staff")
  if (allowed && !staff.roles.some((r) => allowed.includes(r))) redirect("/farm?error=access_denied")

  return { tenant, staff, db }
})

export const OWNER_ONLY: StaffRole[] = ["owner"]
export const ORDER_DESK: StaffRole[] = ["owner", "order_desk"]
