"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { createSSRClient } from "@/lib/supabase/server"

const input = z.object({
  name: z.string().trim().min(1).max(60),
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
})

/** Anyone on the farm can change their own name and password. The current password is checked first. */
export async function saveAccount(raw: unknown): Promise<{ error?: string }> {
  const parsed = input.safeParse(raw)
  if (!parsed.success) return { error: "password_short" }
  const { name, currentPassword, newPassword } = parsed.data
  const { db, staff } = await requireStaff()

  if (newPassword) {
    if (!currentPassword) return { error: "current_wrong" }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "no_sign_in" }
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) return { error: "no_sign_in" }
    const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
    if (wrong) return { error: "current_wrong" }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.code === "same_password" ? "same_password" : "generic" }
  }

  await db.staffMember.updateMany({ where: { id: staff.id }, data: { name } })
  revalidatePath("/farm", "layout")
  return {}
}
