"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createSSRClient } from "@/lib/supabase/server"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "@/lib/demo-auth"

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
