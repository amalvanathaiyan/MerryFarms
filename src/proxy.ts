import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { isLocale } from "./i18n/routing"
import { DEMO_AUTH_PREFIX, DEMO_COOKIE, isDemoLoginEnabled } from "./lib/demo-auth"
import { authCookieOptions } from "./lib/supabase/cookie-options"
import { appBase, belongsElsewhere, hostConfigFromEnv, openingApp, readHost } from "./domain/app-hosts"

/**
 * Multi-tenant proxy (Next.js 16 — renamed from middleware)
 *
 * 0. Each app has its own address (src/domain/app-hosts.ts): a page asked for on another app's address is sent there.
 *    Passes on which app the address is for (x-host-app), whether the address names the farm (x-farm-address), and
 *    which opening plays (x-opening-app).
 * 1. Resolves the farm from the host and passes it on as the x-tenant-slug REQUEST header:
 *      merryfarms.farmforyou.in, merryfarms-farm.farmforyou.in → "merryfarms" (NEXT_PUBLIC_ROOT_DOMAIN=farmforyou.in)
 *      merryfarms.localhost   → "merryfarms"   (local dev)
 *      anything else          → the farm chosen by a /f/<farm> link (cookie), else DEFAULT_TENANT_SLUG
 *    Until farms have their own subdomains, /f/<farm>/<path> picks the farm for this browser and goes on to /<path>.
 *    The default farm's link clears the choice. With a root domain set, /f/<farm> goes to the farm's subdomain
 *    (its farm-app address for /f/<farm>/farm).
 * 2. Passes the language on as x-locale: NEXT_LOCALE cookie, else Tamil.
 * 3. On farm-app pages, refreshes the Supabase session and sends signed-out users to /login
 *    (in local demo mode, a demo sign-in cookie is accepted instead — see lib/demo-auth.ts).
 */

const FARM_COOKIE = "ffy_farm"
/** src/server/support.ts: a super admin's support visit (that file needs the database, so not imported here) */
const SUPPORT_COOKIE = "ffy_support"
const FARM_LINK = /^\/f\/([a-z][a-z0-9-]{1,28}[a-z0-9])(\/.*)?$/
const SLUG = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const requestHeaders = new Headers(request.headers)

  const host = request.headers.get("host") ?? ""
  const hosts = hostConfigFromEnv(process.env)
  const here = readHost(host, hosts)
  const fromSubdomain = here.slug

  // /f/<farm>/<path>: choose the farm, then carry on to /<path>
  const link = FARM_LINK.exec(pathname)
  if (link) {
    const [, slug, rest = "/"] = link
    if (hosts.rootDomain) {
      const app = rest.startsWith("/farm") || here.app === "farm" ? "farm" : "shop"
      return NextResponse.redirect(new URL(`${rest}${request.nextUrl.search}`, appBase(app, slug, hosts)!))
    }
    const url = request.nextUrl.clone()
    url.pathname = rest
    const res = NextResponse.redirect(url)
    if (slug === process.env.DEFAULT_TENANT_SLUG) res.cookies.delete(FARM_COOKIE)
    else res.cookies.set(FARM_COOKIE, slug, { path: "/", sameSite: "lax", httpOnly: true, secure: request.nextUrl.protocol === "https:", maxAge: 60 * 60 * 24 * 365 })
    return res
  }

  const chosen = request.cookies.get(FARM_COOKIE)?.value
  const slug = fromSubdomain ?? (chosen && SLUG.test(chosen) ? chosen : null) ?? process.env.DEFAULT_TENANT_SLUG ?? ""

  // A page of another app: off to that app's address, for the same farm
  const away = belongsElsewhere(here.app, pathname, request.nextUrl.search, !!request.cookies.get(SUPPORT_COOKIE))
  if (away === "farm-home" || away === "admin-home") return NextResponse.redirect(new URL(away === "farm-home" ? "/farm" : "/admin", request.url))
  if (away) {
    const base = appBase(away, slug || null, hosts)
    if (base) return NextResponse.redirect(new URL(`${base}${pathname}${request.nextUrl.search}`))
  }
  requestHeaders.set("x-host-app", here.app)
  requestHeaders.set("x-farm-address", fromSubdomain ? "1" : "")
  requestHeaders.set("x-opening-app", openingApp(here.app, pathname, request.nextUrl.search))
  requestHeaders.set("x-tenant-slug", slug)
  // If a chosen farm no longer exists, the app falls back to the default farm instead of showing nothing
  if (!fromSubdomain) requestHeaders.set("x-tenant-fallback", process.env.DEFAULT_TENANT_SLUG ?? "")
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value
  requestHeaders.set("x-locale", isLocale(cookieLocale) ? cookieLocale : "ta")

  const next = () => NextResponse.next({ request: { headers: requestHeaders } })
  let response = next()

  // The farm app and the platform admin both need a signed-in user; each page then checks who they are.
  const isFarmApp = pathname.startsWith("/farm") || pathname.startsWith("/admin")
  // Demo mode (local only): the page itself checks the demo staff member belongs to this farm.
  if (isFarmApp && isDemoLoginEnabled() && request.cookies.get(DEMO_COOKIE)?.value.startsWith(DEMO_AUTH_PREFIX)) {
    return response
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!isFarmApp || !supabaseUrl || !supabaseKey) return response

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: authCookieOptions(),
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|workbox-).*)"],
}
