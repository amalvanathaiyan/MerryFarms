"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createSSRClient } from "@/lib/supabase/server"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "@/lib/demo-auth"
import { farmUrl } from "@/lib/farm-url"
import { farmKnownFromAddress, getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { absoluteUrl } from "@/lib/urls"
import { normaliseStaffCode } from "@/domain/staff"
import { normaliseIndianMobile } from "@/domain/phone"
import { checkSlug } from "@/domain/tenants"
import { farmSignup, homeAfterSignIn, provisionFromMetadata, provisionSignup } from "@/server/platform"
import { staffLoginEmail } from "@/server/staff"

const MIN_PASSWORD = 8

const loginInput = z.object({
  mode: z.enum(["email", "staff"]),
  email: z.string().trim().max(120),
  farm: z.string().trim().toLowerCase().max(30),
  staffId: z.string().max(20),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
})

/** Email for owners; Staff ID on one farm for staff. Wrong ID and wrong password read the same, so IDs can't be guessed. */
export async function signIn(raw: unknown): Promise<{ error: string } | undefined> {
  const parsed = loginInput.safeParse(raw)
  if (!parsed.success) return { error: "wrong_login" }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "no_sign_in" }
  const { mode, password, next } = parsed.data
  const host = await getTenant()

  let email = parsed.data.email
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

  // A sign-up whose confirm link was opened in another browser finishes here.
  await provisionFromMetadata(data.user.id, data.user.email ?? email, data.user.user_metadata).catch((e) => console.error("[sign-up]", (e as Error).message))
  if (farm && farm.id !== host?.id) redirect(farmUrl(farm.slug, "/farm") ?? "/farm")
  redirect(await homeAfterSignIn(data.user.id, host?.id, next))
}

const registerInput = farmSignup.extend({ email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(MIN_PASSWORD).max(200) })

/** A farm signs itself up. Without farm addresses (single-farm launch) a new farm would have nowhere to open, so it can't. */
export async function registerFarm(raw: unknown): Promise<{ error: string } | { confirmEmail: true }> {
  const parsed = registerInput.safeParse(raw)
  if (!parsed.success) return { error: "invalid_form" }
  const { email, password, ...farm } = parsed.data
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !farmUrl(farm.slug)) return { error: "signup_closed" }
  const phone = normaliseIndianMobile(farm.phone)
  if (!phone) return { error: "phone_invalid" }
  const slugProblem = checkSlug(farm.slug)
  if (slugProblem) return { error: slugProblem }
  if (await prisma.tenant.findUnique({ where: { slug: farm.slug }, select: { id: true } })) return { error: "slug_taken" }

  const signup = { ...farm, phone }
  const supabase = await createSSRClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { farmSignup: signup }, emailRedirectTo: await absoluteUrl("/auth/callback") },
  })
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") return { error: "email_taken" }
    if (error.status === 429) return { error: "too_many_emails" }
    console.error("[sign-up]", error.message)
    return { error: "generic" }
  }
  // With "Confirm email" on there is no session yet; the emailed link comes back to /auth/callback.
  if (!data.session || !data.user) return { confirmEmail: true }
  const slug = await provisionSignup(data.user.id, email, signup)
  redirect(farmUrl(slug, "/farm") ?? "/farm")
}

/** Always reports success unless Supabase is refusing, so this page can't be used to test whose email is registered. */
export async function sendPasswordReset(rawEmail: string): Promise<{ error?: string }> {
  const email = z.string().trim().email().max(120).safeParse(rawEmail)
  if (!email.success) return { error: "invalid_form" }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: "no_sign_in" }
  const supabase = await createSSRClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: await absoluteUrl("/auth/callback?type=recovery") })
  if (error?.status === 429) return { error: "too_many_emails" }
  if (error) console.error("[password reset]", error.message)
  return {}
}

/** The last step of "Forgot password": the emailed link has already signed them in. */
export async function setNewPassword(password: string): Promise<{ error: string } | undefined> {
  if (password.length < MIN_PASSWORD || password.length > 200) return { error: "password_short" }
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "link_expired" }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.code === "same_password" ? "same_password" : "generic" }
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
