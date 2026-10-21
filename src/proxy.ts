import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { isLocale } from "./i18n/routing"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "./lib/demo-auth"

/**
 * Multi-tenant proxy (Next.js 16 — renamed from middleware)
 *
 * 1. Resolves the farm from the host and passes it on as the x-tenant-slug REQUEST header:
 *      merryfarms.farm4u.in   → "merryfarms"   (NEXT_PUBLIC_ROOT_DOMAIN=farm4u.in)
 *      merryfarms.localhost   → "merryfarms"   (local dev)
 *      anything else          → DEFAULT_TENANT_SLUG (single-farm launch on a free host)
 * 2. Passes the language on as x-locale: NEXT_LOCALE cookie, else Tamil.
 * 3. On farm-app pages, refreshes the Supabase session and sends signed-out users to /login
 *    (in local demo mode, a demo sign-in cookie is accepted instead — see lib/demo-auth.ts).
 */

function tenantSlugFromHost(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase()
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase()
  if (root && hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(root.length + 1))
    if (sub && !sub.includes(".") && sub !== "www" && sub !== "admin") return sub
  }
  if (hostname.endsWith(".localhost")) return hostname.split(".")[0]
  return process.env.DEFAULT_TENANT_SLUG ?? null
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set("x-tenant-slug", tenantSlugFromHost(request.headers.get("host") ?? "") ?? "")
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  requestHeaders.set("x-locale", isLocale(cookieLocale) ? cookieLocale : "ta")

  const next = () => NextResponse.next({ request: { headers: requestHeaders } })
  let response = next()

  const isFarmApp = pathname.startsWith("/farm")
  // Demo mode (local only): the page itself checks the demo staff member belongs to this farm.
  if (isFarmApp && isDemoLoginEnabled() && request.cookies.get(DEMO_COOKIE)?.value.startsWith(DEMO_AUTH_PREFIX)) {
    return response
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isFarmApp || !supabaseUrl || !supabaseKey) return response

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        requestHeaders.set("cookie", request.cookies.toString())
        response = next()
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // getUser() validates the token with Supabase; getSession() would trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|workbox-).*)"],
}
