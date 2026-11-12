import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSSRClient } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import { prisma } from "@/lib/prisma"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "@/lib/demo-auth"
import type { Language, StaffRole, SupportVisit } from "@prisma/client"
import { adminUrl } from "@/lib/farm-url"
import { hasSupportCookie, openVisitFor } from "@/server/support"
import { effectiveRoles } from "@/domain/staff"

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
  // A password someone else was shown is only good for making their own.
  if (user?.app_metadata?.tempPassword) redirect("/auth/update-password")
  return user?.id ?? null
}

/**
 * The signed-in staff member of THIS farm, or a redirect to /login.
 * A login that belongs to another farm gets no access here.
 * `staff.roles` are the roles they act with (a manager also acts as owner); `staff.storedRoles` are as saved.
 */
export const requireStaff = cache(async (allowed?: StaffRole[]) => {
  const tenant = await requireTenant()
  const authUserId = await currentAuthUserId()
  if (!authUserId) redirect("/login")

  const db = tenantDb(tenant.id)
  const staff = await db.staffMember.findFirst({ where: { authUserId, isActive: true } })
  if (!staff) {
    // A FarmForYou super admin in support mode: the farm app as its owner, as "FarmForYou support".
    const visit = await openVisitFor(tenant.id)
    if (visit && visit.adminAuthUserId === authUserId && (await prisma.platformAdmin.findUnique({ where: { authUserId }, select: { id: true } }))) {
      return { tenant, staff: supportStaff(tenant, visit, authUserId), db, support: visit }
    }
    if (await hasSupportCookie()) redirect(`${adminUrl()}?support=ended`)
    redirect("/login?error=not_staff")
  }
  const roles = effectiveRoles(staff.roles)
  if (allowed && !roles.some((r) => allowed.includes(r))) redirect("/farm?error=access_denied")

  return { tenant, staff: { ...staff, roles, storedRoles: staff.roles }, db, support: null }
})

/**
 * The stand-in staff member for a support visit: owner rights, so anything can be fixed; its id marks what it did
 * ("support-<visit>"), which belongs to no real staff member.
 */
function supportStaff(tenant: { id: string; defaultLanguage: Language }, visit: SupportVisit, authUserId: string) {
  const roles: StaffRole[] = ["owner"]
  return {
    id: `support-${visit.id}`,
    tenantId: tenant.id,
    authUserId,
    staffCode: null,
    name: "Farm For You support",
    phone: null,
    email: null,
    roles,
    storedRoles: roles,
    language: tenant.defaultLanguage,
    isActive: true,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
  }
}

/** Not in support mode: farm logins and passwords are only ever handled in FarmForYou admin. */
export async function requireNotSupport() {
  const ctx = await requireStaff()
  if (ctx.support) redirect("/farm?error=support_blocked")
  return ctx
}

/** Real owners only (not managers): the staff list, i.e. who can sign in to the farm and with what role. */
export const requireStaffAdmin = cache(async () => {
  const ctx = await requireStaff()
  if (ctx.support) redirect("/farm?error=support_blocked")
  if (!ctx.staff.storedRoles.includes("owner")) redirect("/farm?error=access_denied")
  return ctx
})

/**
 * A FarmForYou platform admin (the people who run the platform, not a farm), or a redirect to /login.
 * Being staff at a farm gives no admin rights; only a row in platform_admins does.
 */
export const requirePlatformAdmin = cache(async () => {
  const authUserId = await currentAuthUserId()
  if (!authUserId) redirect("/login?next=/admin")
  const admin = await prisma.platformAdmin.findUnique({ where: { authUserId } })
  if (!admin) redirect("/login?next=/admin&error=not_admin")
  return admin
})

export const OWNER_ONLY: StaffRole[] = ["owner"]
export const ORDER_DESK: StaffRole[] = ["owner", "order_desk"]

/**
 * Who is looking at the shop, when it isn't a customer: this farm's staff, or the FarmForYou super admin.
 * Never redirects. Customers never carry a staff sign-in cookie, so for them it returns at once without asking
 * Supabase anything; the shop stays as fast for them as before.
 */
export const shopViewer = cache(async (tenantId: string): Promise<"staff" | "admin" | null> => {
  const jar = await cookies()
  const demo = isDemoLoginEnabled() && jar.get(DEMO_COOKIE)?.value.startsWith(DEMO_AUTH_PREFIX)
  const supabaseCookie = jar.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
  if (!demo && !supabaseCookie) return null
  let authUserId: string | null = demo ? jar.get(DEMO_COOKIE)!.value : null
  if (!authUserId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSSRClient()
    authUserId = (await supabase.auth.getUser()).data.user?.id ?? null
  }
  if (!authUserId) return null
  if (await tenantDb(tenantId).staffMember.findFirst({ where: { authUserId, isActive: true }, select: { id: true } })) return "staff"
  if (await prisma.platformAdmin.findUnique({ where: { authUserId }, select: { id: true } })) return "admin"
  return null
})
