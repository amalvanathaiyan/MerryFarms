import { NextRequest, NextResponse } from "next/server"
import { createSSRClient } from "@/lib/supabase/server"
import { getTenant } from "@/lib/tenant"
import { absoluteUrl } from "@/lib/urls"
import { homeAfterSignIn } from "@/server/platform"

/** Where Supabase's emails land, such as the "Forgot password" link. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const recovery = request.nextUrl.searchParams.get("type") === "recovery"

  // A "Forgot password" link arrives with its sign-in after the # in the address. The server can't see that part,
  // but the browser keeps it through this redirect, and the page reads it there.
  if (!code && recovery) return NextResponse.redirect(await absoluteUrl("/auth/update-password"))

  if (code) {
    const supabase = await createSSRClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      if (recovery) return NextResponse.redirect(await absoluteUrl("/auth/update-password"))
      const home = await homeAfterSignIn(data.user.id, (await getTenant())?.id)
      return NextResponse.redirect(home.startsWith("/") ? await absoluteUrl(home) : home)
    }
  }
  return NextResponse.redirect(await absoluteUrl("/login?error=auth_failed"))
}
