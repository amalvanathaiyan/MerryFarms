"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createEmailLinkClient, createServiceClient, createSSRClient } from "@/lib/supabase/server"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "@/lib/demo-auth"
import { farmUrl } from "@/lib/farm-url"
import { farmKnownFromAddress, getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/urls"
import { normaliseStaffCode } from "@/domain/staff"
import { homeAfterSignIn } from "@/server/platform"
import { staffLoginEmail } from "@/server/staff"
import { usernameLoginEmail } from "@/server/usernames"
import { isEmailLogin } from "@/domain/username"

const MIN_PASSWORD = 8

const loginInput = z.object({
  mode: z.enum(["email", "staff"]),
  email: z.string().trim().max(120),
  farm: z.string().trim().toLowerCase().max(30),
  staffId: z.string().max(20),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
})

/**
 * Super admins and farm admins (owners): email or username. Staff: Staff ID on one farm.
 * A wrong ID or username and a wrong password read the same, so neither can be guessed.
 */
export async function signIn(raw: unknown): Promise<{ error: string } | undefined> {
  const parsed = loginInput.safeParse(raw)
  if (!parsed.success) return { error: "wrong_login" }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "no_sign_in" }
  const { mode, password, next } = parsed.data
  const host = await getTenant()

  let email = parsed.data.email
  if (mode === "email" && !isEmailLogin(email)) {
    const found = await usernameLoginEmail(email)
    if (!found) return { error: "wrong_login" }
    email = found
  }
  let farm: { id: string; slug: string } | null = null
  if (mode === "staff") {
    farm = (await farmKnownFromAddress()) ? host : await prisma.tenant.findUnique({ where: { slug: parsed.data.farm }, select: { id: true, slug: true } })
    if (!farm) return { error: "farm_not_found" }
    const found = await staffLoginEmail(farm.id, normaliseStaffCode(parsed.data.staffId))
    if (!found) return { error: "wrong_login" }
    email = found
  }

  const supabase = await createSSRClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.code === "email_not_confirmed" ? "email_not_confirmed" : "wrong_login" }

  if (farm && farm.id !== host?.id) redirect(farmUrl(farm.slug, "/farm") ?? "/farm")
  redirect(await homeAfterSignIn(data.user.id, host?.id, next))
}

/** Always reports success unless Supabase is refusing, so this page can't be used to test whose email is registered. */
export async function sendPasswordReset(rawEmail: string): Promise<{ error?: string }> {
  const email = z.string().trim().email().max(120).safeParse(rawEmail)
  if (!email.success) return { error: "invalid_form" }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "no_sign_in" }
  const { error } = await createEmailLinkClient().auth.resetPasswordForEmail(email.data, { redirectTo: await absoluteUrl("/auth/callback?type=recovery") })
  if (error?.status === 429) return { error: "too_many_emails" }
  if (error) console.error("[password reset]", error.message)
  return {}
}

/** The emailed link carries its sign-in in the address, where only the browser can read it; this turns it into a session. */
export async function openRecoveryLink(raw: unknown): Promise<{ error?: string }> {
  const tokens = z.object({ access_token: z.string().min(1).max(4000), refresh_token: z.string().min(1).max(400) }).safeParse(raw)
  if (!tokens.success) return { error: "link_expired" }
  const supabase = await createSSRClient()
  const { error } = await supabase.auth.setSession(tokens.data)
  return error ? { error: "link_expired" } : {}
}

/** The last step of "Forgot password" or a first sign-in with a temporary password. */
export async function setNewPassword(password: string): Promise<{ error: string } | undefined> {
  if (password.length < MIN_PASSWORD || password.length > 200) return { error: "password_short" }
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "link_expired" }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.code === "same_password" ? "same_password" : "generic" }
  if (user.app_metadata?.tempPassword) {
    const { error: flag } = await createServiceClient().auth.admin.updateUserById(user.id, { app_metadata: { tempPassword: false } })
    if (flag) return { error: "generic" }
  }
  redirect(await homeAfterSignIn(user.id, (await getTenant())?.id))
}

export async function signOut() {
  if (isDemoLoginEnabled()) (await cookies()).delete(DEMO_COOKIE)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSSRClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}

/** Platform admins sign out back to the admin sign-in. */
export async function signOutAdmin() {
  if (isDemoLoginEnabled()) (await cookies()).delete(DEMO_COOKIE)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSSRClient()
    await supabase.auth.signOut()
  }
  redirect("/login?next=/admin")
}

/** Demo mode only: sign in as one of the seeded demo staff members. */
export async function demoSignIn(authUserId: string, to: "/farm" | "/admin" = "/farm") {
  if (!isDemoLoginEnabled() || !authUserId.startsWith(DEMO_AUTH_PREFIX)) redirect("/login")
  ;(await cookies()).set(DEMO_COOKIE, authUserId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 12 })
  redirect(to === "/admin" ? "/admin" : "/farm")
}
