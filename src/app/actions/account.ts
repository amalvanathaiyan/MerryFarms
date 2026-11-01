"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin, requireStaff } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSSRClient } from "@/lib/supabase/server"

const input = z.object({
  name: z.string().trim().min(1).max(60),
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

/** Anyone on the farm can change their own name and password. */
export async function saveAccount(raw: unknown): Promise<{ error?: string }> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { error: "password_short" }
  const { name, currentPassword, newPassword } = parsed.data
  const { db, staff } = await requireStaff()

  if (newPassword) {
    const error = await changePassword(currentPassword, newPassword)
    if (error) return { error }
  }

  await db.staffMember.updateMany({ where: { id: staff.id }, data: { name } })
  revalidatePath("/farm", "layout")
  return {}
}

/** A platform admin's own name and password. */
export async function saveAdminAccount(raw: unknown): Promise<{ error?: string }> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { error: "password_short" }
  const { name, currentPassword, newPassword } = parsed.data
  const admin = await requirePlatformAdmin()

  if (newPassword) {
    const error = await changePassword(currentPassword, newPassword)
    if (error) return { error }
  }

  await prisma.platformAdmin.update({ where: { id: admin.id }, data: { name } })
  revalidatePath("/admin", "layout")
  return {}
}
