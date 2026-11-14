/**
 * Which app an address is for. Pure, so it is tested; src/proxy.ts and src/lib/farm-url.ts use it.
 *
 * Each app has its own address, so a phone can install all of them side by side (one installed app per address:
 * Android counts a second app on the same address as "already installed").
 *
 *   With the domain (ROOT_DOMAIN=farmforyou.in):
 *     merryfarms.farmforyou.in        the farm's shop, for customers
 *     merryfarms-farm.farmforyou.in   the farm's farm app, for its owner and staff
 *     farmforyou.in                   the portal, with FarmForYou admin at /admin
 *   Before the domain, one fixed address per app (SHOP_HOST, FARM_APP_HOST, PORTAL_HOST), e.g.
 *     merry-farms.vercel.app, farmforyou-farm.vercel.app, farmforyou.vercel.app;
 *     the farm on them is the default farm, or the one a /f/<farm> link picked.
 *   Any other address (local development, preview deployments): every app on one address, as before.
 * Moving to the domain is a settings change: set ROOT_DOMAIN, add the domain in Vercel.
 */

export type HostApp = "shop" | "farm" | "portal" | "all"
export type InstalledApp = "shop" | "farm" | "admin"

export interface HostConfig {
  rootDomain?: string
  shopHost?: string
  farmHost?: string
  portalHost?: string
  defaultSlug?: string
}

/** What an address is for; `slug` when the address itself names the farm. */
export interface HostInfo {
  app: HostApp
  slug: string | null
}

/** A farm's farm-app subdomain ends with this: merryfarms-farm. Farm slugs can't end with it (src/domain/tenants.ts). */
export const FARM_APP_SUFFIX = "-farm"

const SLUG = /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/
const clean = (h: string | undefined) => h?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || undefined

export function hostConfigFromEnv(env: Record<string, string | undefined>): HostConfig {
  return {
    rootDomain: clean(env.NEXT_PUBLIC_ROOT_DOMAIN),
    shopHost: clean(env.SHOP_HOST),
    farmHost: clean(env.FARM_APP_HOST),
    portalHost: clean(env.PORTAL_HOST),
    defaultSlug: env.DEFAULT_TENANT_SLUG || undefined,
  }
}

/** A subdomain's farm and app: "merryfarms" → the shop, "merryfarms-farm" → the farm app. */
function fromSubdomain(sub: string): HostInfo | null {
  if (sub.endsWith(FARM_APP_SUFFIX)) {
    const slug = sub.slice(0, -FARM_APP_SUFFIX.length)
    return SLUG.test(slug) ? { app: "farm", slug } : null
  }
  return SLUG.test(sub) ? { app: "shop", slug: sub } : null
}

export function readHost(host: string, cfg: HostConfig): HostInfo {
  const name = host.split(":")[0].toLowerCase()
  const root = cfg.rootDomain
  if (root) {
    if (name === root || name === `www.${root}` || name === `admin.${root}`) return { app: "portal", slug: null }
    if (name.endsWith(`.${root}`)) {
      const sub = name.slice(0, -(root.length + 1))
      if (!sub.includes(".")) return fromSubdomain(sub) ?? { app: "portal", slug: null }
    }
  }
  if (name === cfg.shopHost) return { app: "shop", slug: null }
  if (name === cfg.farmHost) return { app: "farm", slug: null }
  if (name === cfg.portalHost) return { app: "portal", slug: null }
  // Local development: merryfarms.localhost is the farm, every app on it (merryfarms-farm.localhost: the farm app only)
  if (name.endsWith(".localhost")) {
    const found = fromSubdomain(name.split(".")[0])
    if (found) return found.app === "farm" ? found : { app: "all", slug: found.slug }
  }
  return { app: "all", slug: null }
}

/**
 * The start of an app's address for a farm, with no trailing slash, or null when it is this same address (every app
 * on one address). On the fixed addresses another farm is picked with a /f/<farm> link.
 */
export function appBase(app: Exclude<HostApp, "all">, slug: string | null, cfg: HostConfig): string | null {
  const root = cfg.rootDomain
  if (root) {
    if (app === "portal" || !slug) return `https://${root}`
    return `https://${slug}${app === "farm" ? FARM_APP_SUFFIX : ""}.${root}`
  }
  const host = app === "shop" ? cfg.shopHost : app === "farm" ? cfg.farmHost : cfg.portalHost
  if (!host) return null
  const pick = app !== "portal" && slug && slug !== cfg.defaultSlug ? `/f/${slug}` : ""
  return `https://${host}${pick}`
}

/** Which app a path belongs to on an address that holds them all. */
export function appOfPath(pathname: string, search = ""): InstalledApp {
  const nextAdmin = pathname === "/login" && /[?&]next=%2Fadmin|[?&]next=\/admin/.test(search)
  if (pathname.startsWith("/admin") || nextAdmin) return "admin"
  if (pathname.startsWith("/farm") || pathname === "/login") return "farm"
  return "shop"
}

/** Pages every address serves: sign-in links from emails, images, the install manifest, background jobs, legal pages. */
const EVERYWHERE = /^\/(auth|forgot-password|app-manifest|img|api|offline|_next|legal)(\/|$)/

/** Farm For You's own pages, on the portal: the home page (the portal's "/") and "Register your farm". */
export const HOME_PATH = "/welcome"
const PORTAL_PAGES = /^\/(welcome|join)(\/|$)/

/**
 * Where a request belongs, when this address is for another app: the app to send it to, or null to serve it here.
 *   the shop:      the farm app's and admin's pages go to their addresses;
 *   the farm app:  opens at /farm; admin goes to the portal, customers' pages (bills, "my orders") to the shop;
 *   the portal:    "/" is Farm For You's home page (shown from /welcome); a farm's app only in support mode (the super
 *                  admin is signed in here).
 *   Farm For You's home page and "Register your farm" are the portal's: the other apps send them there.
 */
export function belongsElsewhere(app: HostApp, pathname: string, search: string, support: boolean): Exclude<HostApp, "all"> | "farm-home" | "home" | null {
  if (app === "all" || EVERYWHERE.test(pathname)) return null
  if (PORTAL_PAGES.test(pathname)) return app === "portal" ? null : "portal"
  const owner = appOfPath(pathname, search)
  if (app === "shop") return owner === "shop" ? null : owner === "admin" ? "portal" : "farm"
  if (app === "farm") {
    if (pathname === "/") return "farm-home"
    return owner === "farm" ? null : owner === "admin" ? "portal" : "shop"
  }
  // portal
  if (pathname === "/") return "home"
  if (owner === "admin") return null
  if (owner === "farm") return support || pathname === "/login" ? null : "farm"
  return "shop"
}

/** Which opening plays when an installed app starts at this address and path (src/lib/opening.ts). */
export function openingApp(app: HostApp, pathname: string, search = ""): InstalledApp {
  if (app === "shop") return "shop"
  if (app === "farm") return "farm"
  if (app === "portal") return pathname.startsWith("/farm") ? "farm" : "admin"
  return appOfPath(pathname, search)
}
