/**
 * Who may change whom on the farm's staff list. A farm must always keep at least one
 * active owner, and an owner can't lock themselves out.
 */

export type Role = "owner" | "manager" | "order_desk" | "packing" | "delivery"
/** "manager" has the owner's rights everywhere except the staff list (see effectiveRoles). */
export const ROLES: Role[] = ["owner", "manager", "order_desk", "packing", "delivery"]

/**
 * The roles someone acts with: a manager also acts as owner. Only the staff list (who can sign in, with what
 * role) is kept to real owners, so a manager can't remove the owner or lock them out; that checks stored roles.
 */
export function effectiveRoles<R extends string>(roles: readonly R[]): R[] {
  return roles.includes("manager" as R) && !roles.includes("owner" as R) ? [...roles, "owner" as R] : [...roles]
}

type Member = { id: string; roles: Role[]; isActive: boolean }

export type StaffChange = { kind: "roles"; roles: Role[] } | { kind: "deactivate" } | { kind: "reactivate" }

export function checkStaffChange(staff: Member[], actorId: string, targetId: string, change: StaffChange): string | null {
  const target = staff.find((s) => s.id === targetId)
  if (!target) return "staff_not_found"
  const otherActiveOwners = staff.filter((s) => s.id !== targetId && s.isActive && s.roles.includes("owner")).length
  if (change.kind === "roles") {
    if (change.roles.length === 0) return "roles_required"
    const losesOwner = target.isActive && target.roles.includes("owner") && !change.roles.includes("owner")
    if (losesOwner && otherActiveOwners === 0) return "last_owner"
    if (losesOwner && targetId === actorId) return "cannot_change_self"
  }
  if (change.kind === "deactivate") {
    if (targetId === actorId) return "cannot_change_self"
    if (target.roles.includes("owner") && otherActiveOwners === 0) return "last_owner"
  }
  return null
}

/** The next Staff ID on a farm: the first three letters of its web address, then a number. merryfarms → MER-001. */
export function nextStaffCode(slug: string, existing: (string | null)[]): string {
  const prefix = slug.replace(/[^a-z0-9]/g, "").slice(0, 3).toUpperCase()
  const used = existing.map((c) => Number(c?.split("-").pop())).filter(Number.isInteger)
  return `${prefix}-${String(Math.max(0, ...used) + 1).padStart(3, "0")}`
}

export const normaliseStaffCode = (raw: string) => raw.trim().toUpperCase()

/** Staff without an email still need one for their Supabase login. They never see it; the farm id keeps it unique. */
export const internalStaffEmail = (code: string, tenantId: string) => `${code.toLowerCase()}.${tenantId}@staff.farmforyou.internal`
