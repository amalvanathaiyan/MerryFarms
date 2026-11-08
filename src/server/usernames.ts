import "server-only"
import { prisma } from "@/lib/prisma"
import { createServiceClient } from "@/lib/supabase/server"
import { checkUsername, normaliseUsername } from "@/domain/username"
import { OrderError } from "./orders"

/**
 * Usernames for super admins and farm admins (owners). A username names one login, so it lives in its own
 * platform-wide table, not on a farm. Staff sign in with their Staff ID instead.
 */

/** The email this login signs in with, if it may use a username at all: a super admin, or an active owner on a farm. */
async function eligibleEmail(authUserId: string): Promise<{ eligible: boolean; email: string | null }> {
  const admin = await prisma.platformAdmin.findUnique({ where: { authUserId }, select: { email: true } })
  if (admin) return { eligible: true, email: admin.email }
  const owner = await prisma.staffMember.findFirst({ where: { authUserId, isActive: true, roles: { has: "owner" } }, select: { email: true } })
  if (owner) return { eligible: true, email: owner.email }
  return { eligible: false, email: null }
}

export async function usernameOf(authUserId: string): Promise<string | null> {
  return (await prisma.loginUsername.findUnique({ where: { authUserId } }))?.username ?? null
}

/**
 * Sets, changes or (with an empty value) removes the username of a login. Codes: username_invalid,
 * username_taken, username_not_allowed.
 */
export async function setUsername(authUserId: string, raw: string): Promise<void> {
  const username = normaliseUsername(raw)
  if (!username) {
    await prisma.loginUsername.deleteMany({ where: { authUserId } })
    return
  }
  const problem = checkUsername(username)
  if (problem) throw new OrderError(problem)
  if (!(await eligibleEmail(authUserId)).eligible) throw new OrderError("username_not_allowed")

  const holder = await prisma.loginUsername.findUnique({ where: { username } })
  if (holder && holder.authUserId !== authUserId) throw new OrderError("username_taken")
  if (holder) return
  try {
    await prisma.$transaction([prisma.loginUsername.deleteMany({ where: { authUserId } }), prisma.loginUsername.create({ data: { username, authUserId } })])
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new OrderError("username_taken")
    throw e
  }
}

/**
 * The login behind a username, with the email to sign in with. Null when there's no such username, or its login
 * is no longer a super admin or an active owner (a removed owner's username stops working with their access).
 */
export async function usernameLogin(raw: string): Promise<{ authUserId: string; email: string | null } | null> {
  const username = normaliseUsername(raw)
  if (checkUsername(username)) return null
  const row = await prisma.loginUsername.findUnique({ where: { username } })
  if (!row) return null
  const { eligible, email } = await eligibleEmail(row.authUserId)
  return eligible ? { authUserId: row.authUserId, email } : null
}

/** Email to sign a username in with: the one kept on record, else the login's own from Supabase. */
export async function usernameLoginEmail(raw: string): Promise<string | null> {
  const found = await usernameLogin(raw)
  if (!found) return null
  if (found.email) return found.email
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const { data } = await createServiceClient().auth.admin.getUserById(found.authUserId)
  return data.user?.email ?? null
}
