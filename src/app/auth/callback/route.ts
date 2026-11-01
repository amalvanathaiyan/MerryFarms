import { NextRequest, NextResponse } from "next/server"
import { createSSRClient } from "@/lib/supabase/server"
import { getTenant } from "@/lib/tenant"
import { absoluteUrl } from "@/lib/urls"
import { homeAfterSignIn, provisionFromMetadata } from "@/server/platform"

/** Where Supabase's emails land: the link confirming a new owner's email, and the "Forgot password" link. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const recovery = request.nextUrl.searchParams.get("type") === "recovery"

  if (code) {
    const supabase = await createSSRClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      if (recovery) return NextResponse.redirect(await absoluteUrl("/auth/update-password"))
      await provisionFromMetadata(data.user.id, data.user.email ?? "", data.user.user_metadata).catch((e) => console.error("[sign-up]", (e as Error).message))
      const home = await homeAfterSignIn(data.user.id, (await getTenant())?.id)
      return NextResponse.redirect(home.startsWith("/") ? await absoluteUrl(home) : home)
    }
  }
  return NextResponse.redirect(await absoluteUrl("/login?error=auth_failed"))
}
