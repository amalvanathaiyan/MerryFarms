"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin, requireStaff } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSRClient } from "@/lib/supabase/server"
import { OrderError } from "@/server/orders"
import { setUsername } from "@/server/usernames"

const input = z.object({
  name: z.string().trim().min(1).max(60),
  /** Left out when this person can't have a username; empty removes it. */
  username: z.string().max(60).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
})

/** The current password is checked first. Returns an error code, or nothing once changed. */
async function changePassword(currentPassword: string | undefined, newPassword: string) {
  if (!currentPassword) return "current_wrong"
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return "no_sign_in"
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return "no_sign_in"
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (wrong) return "current_wrong"
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return error.code === "same_password" ? "same_password" : "generic"
}

/** Saves the username first, so a taken one stops the save before anything else changes. */
async function saveUsername(authUserId: string, username: string | undefined) {
  if (username === undefined) return
  try {
    await setUsername(authUserId, username)
  } catch (e) {
    if (e instanceof OrderError) return e.code
    throw e
  }
}

/** Anyone on the farm can change their own name and password; farm admins (owners) also their username. */
export async function saveAccount(raw: unknown): Promise<{ error?: string }> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { error: "password_short" }
  const { name, username, currentPassword, newPassword } = parsed.data
  const { db, staff } = await requireStaff()

  const usernameError = await saveUsername(staff.authUserId, staff.storedRoles.includes("owner") ? username : undefined)
  if (usernameError) return { error: usernameError }

  if (newPassword) {
    const error = await changePassword(currentPassword, newPassword)
    if (error) return { error }
  }

  await db.staffMember.updateMany({ where: { id: staff.id }, data: { name } })
  revalidatePath("/farm", "layout")
  return {}
}

/** A super admin's own name, username and password. */
export async function saveAdminAccount(raw: unknown): Promise<{ error?: string }> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { error: "password_short" }
  const { name, username, currentPassword, newPassword } = parsed.data
  const admin = await requirePlatformAdmin()

  const usernameError = await saveUsername(admin.authUserId, username)
  if (usernameError) return { error: usernameError }

  if (newPassword) {
    const error = await changePassword(currentPassword, newPassword)
    if (error) return { error }
  }

  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { name } })
  revalidatePath("/admin", "layout")
  return {}
}
