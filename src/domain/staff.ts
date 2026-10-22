/**
 * Who may change whom on the farm's staff list. A farm must always keep at least one
 * active owner, and an owner can't lock themselves out.
 */
import { randomInt } from "node:crypto"

export type Role = "owner" | "order_desk" | "packing" | "delivery"
export const ROLES: Role[] = ["owner", "order_desk", "packing", "delivery"]

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

/** A temporary password that is easy to read out on a call: "Farm-4827-kmtq". */
export function tempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz"
  const word = Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join("")
  return `Farm-${String(randomInt(1000, 10000))}-${word}`
}
