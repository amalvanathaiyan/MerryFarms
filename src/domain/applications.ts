/**
 * Farms that register themselves (docs/platform-plan.md §3.8), the pure part: what a farm fills in, the review's
 * steps and checklist, and what can happen next. Tested; src/server/applications.ts loads and saves.
 *
 * An application is not a farm. The Farm For You team reviews it (a call, the location, the documents), and on
 * approval adds the farm from it, as when admin adds one, and hands over the owner's login (no self sign-up logins).
 */
import { isGstin } from "./platform-billing"

/** The seller agreement and prohibited items policy a farm accepts (src/domain/legal.ts); bump when either changes. */
export const AGREEMENT_VERSION = "2026-11-14"

export const APPLICATION_STATES = ["applied", "reviewing", "needs_info", "on_hold", "approved", "rejected"] as const
export type ApplicationState = (typeof APPLICATION_STATES)[number]

/** Still waiting on the team or the farm. */
export const OPEN_STATES: readonly ApplicationState[] = ["applied", "reviewing", "needs_info", "on_hold"]
export const isOpen = (s: string) => (OPEN_STATES as readonly string[]).includes(s)

/** What the reviewer checks, in order. Phone and location are needed before approving; the rest as needed. */
export const CHECKS = ["phone", "location", "documents", "call", "visit"] as const
export type CheckKey = (typeof CHECKS)[number]
export const NEEDED_CHECKS: readonly CheckKey[] = ["phone", "location"]

export function cleanChecklist(json: unknown): Partial<Record<CheckKey, boolean>> {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>
  return Object.fromEntries(CHECKS.filter((k) => o[k] === true).map((k) => [k, true]))
}

/** Checks still missing before the farm can be approved. */
export const missingChecks = (checklist: unknown): CheckKey[] => {
  const done = cleanChecklist(checklist)
  return NEEDED_CHECKS.filter((k) => !done[k])
}

/**
 * Where an application can go from here. Approving happens by adding the farm (not a plain move); a decided one
 * can be opened again only from rejected (a farm that came back with what was missing).
 */
export function nextStates(status: string): ApplicationState[] {
  switch (status) {
    case "applied":
      return ["reviewing", "needs_info", "on_hold", "rejected"]
    case "reviewing":
      return ["needs_info", "on_hold", "rejected"]
    case "needs_info":
    case "on_hold":
      return ["reviewing", "rejected"]
    case "rejected":
      return ["reviewing"]
    default:
      return []
  }
}

/** The farm needs to be told why: what's still needed, or why it was turned down. */
export const needsReply = (to: string) => to === "needs_info" || to === "rejected"

/** "FFY-J0007": the number a farm quotes when it calls. */
export const applicationNumber = (n: number) => `FFY-J${String(n).padStart(4, "0")}`

// What a farm fills in, checked the same way in the form and on the server.

/** FSSAI registration or licence: 14 digits. */
export const isFssai = (v: string) => /^\d{14}$/.test(v)
/** PAN: 5 letters, 4 digits, a letter. */
export const isPan = (v: string) => /^[A-Z]{5}\d{4}[A-Z]$/.test(v)
/** Indian PIN code. */
export const isPincode = (v: string) => /^[1-9]\d{5}$/.test(v)
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

export type FieldProblem = "fssai" | "gstin" | "pan" | "pincode" | "email"

/** The first thing wrong in the optional business details and the address, or null. Empty optional fields are fine. */
export function detailsProblem(a: { email: string; pincode: string; fssai?: string | null; gstin?: string | null; pan?: string | null }): FieldProblem | null {
  if (!isEmail(a.email)) return "email"
  if (!isPincode(a.pincode)) return "pincode"
  if (a.fssai && !isFssai(a.fssai)) return "fssai"
  if (a.gstin && !isGstin(a.gstin)) return "gstin"
  if (a.pan && !isPan(a.pan)) return "pan"
  return null
}

/** At most this many applications from one place in a day, so the form can't be flooded. */
export const MAX_PER_SOURCE_PER_DAY = 5
