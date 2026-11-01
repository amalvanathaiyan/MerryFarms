import "server-only"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"
import { isDemoLoginEnabled, DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { createServiceClient } from "@/lib/supabase/server"
import { checkStaffChange, internalStaffEmail, nextStaffCode, type Role, type StaffChange } from "@/domain/staff"
import { tempPassword } from "@/domain/staff-password"
import { OrderError } from "./orders"

/**
 * Staff logins are Supabase Auth users. Everyone gets a Staff ID; staff without an email sign in with that alone,
 * on a hidden internal email address. In the local demo there is no
 * Supabase: new staff get a demo id and appear as a demo sign-in button instead.
 */
const demoLogins = () => isDemoLoginEnabled() && !process.env.SUPABASE_SERVICE_ROLE_KEY

async function createLogin(email: string, password: string): Promise<{ userId: string; existing: boolean }> {
  if (demoLogins()) return { userId: `${DEMO_AUTH_PREFIX}${randomUUID().slice(0, 8)}`, existing: false }
  const admin = createServiceClient().auth.admin
  const { data, error } = await admin.createUser({ email, password, email_confirm: true })
  if (data.user) return { userId: data.user.id, existing: false }
  if (!error?.message.toLowerCase().includes("already")) throw error
  // The email already has a login (e.g. staff at another farm too): link it, keep their password.
  const { data: list, error: listError } = await admin.listUsers({ perPage: 1000 })
  if (listError) throw listError
  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw error
  return { userId: user.id, existing: true }
}

export async function addStaff(tenantId: string, input: { name: string; email?: string; phone?: string; roles: Role[] }) {
  if (input.roles.length === 0) throw new OrderError("roles_required")
  // An owner needs a real email: it is how they get back in with "Forgot password".
  if (input.roles.includes("owner") && !input.email) throw new OrderError("owner_email_required")
  const db = tenantDb(tenantId)
  const email = input.email?.toLowerCase() || null
  if (email && (await db.staffMember.findFirst({ where: { email } }))) throw new OrderError("staff_exists")
  const { slug } = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { slug: true } })
  const codes = await db.staffMember.findMany({ select: { staffCode: true } })
  const staffCode = nextStaffCode(slug, codes.map((c) => c.staffCode))
  const password = tempPassword()
  const { userId, existing } = await createLogin(email ?? internalStaffEmail(staffCode, tenantId), password)
  const linked = await db.staffMember.findFirst({ where: { authUserId: userId } })
  if (linked) throw new OrderError("staff_exists")
  const member = await db.staffMember.create({ data: { tenantId, authUserId: userId, staffCode, name: input.name, email, phone: input.phone || null, roles: input.roles } })
  // An existing login keeps its own password; a demo login needs none.
  return { member, password: existing || demoLogins() ? null : password }
}

/** The login email behind a Staff ID on this farm, or null when there is no such active staff member. */
export async function staffLoginEmail(tenantId: string, staffCode: string) {
  const member = await tenantDb(tenantId).staffMember.findFirst({ where: { staffCode, isActive: true }, select: { email: true } })
  if (!member) return null
  return member.email ?? internalStaffEmail(staffCode, tenantId)
}

async function guarded(tenantId: string, actorId: string, targetId: string, change: StaffChange) {
  const db = tenantDb(tenantId)
  const staff = await db.staffMember.findMany({ select: { id: true, roles: true, isActive: true } })
  const problem = checkStaffChange(staff, actorId, targetId, change)
  if (problem) throw new OrderError(problem)
  return db
}

export async function updateStaff(tenantId: string, actorId: string, id: string, input: { name: string; phone?: string; roles: Role[] }) {
  const db = await guarded(tenantId, actorId, id, { kind: "roles", roles: input.roles })
  await db.staffMember.updateMany({ where: { id }, data: { name: input.name, phone: input.phone || null, roles: input.roles } })
}

/** Removing access keeps the person on record (their past orders, calls and payments). */
export async function setStaffActive(tenantId: string, actorId: string, id: string, active: boolean) {
  const db = await guarded(tenantId, actorId, id, { kind: active ? "reactivate" : "deactivate" })
  await db.staffMember.updateMany({ where: { id }, data: { isActive: active } })
}

/** A new temporary password for someone who forgot theirs. */
export async function resetStaffPassword(tenantId: string, id: string) {
  const member = await tenantDb(tenantId).staffMember.findFirst({ where: { id } })
  if (!member) throw new OrderError("staff_not_found")
  if (demoLogins() || member.authUserId.startsWith(DEMO_AUTH_PREFIX)) return null
  const password = tempPassword()
  const { error } = await createServiceClient().auth.admin.updateUserById(member.authUserId, { password })
  if (error) throw error
  return password
}
