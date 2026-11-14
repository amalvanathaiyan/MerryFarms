import { appBase, hostConfigFromEnv } from "@/domain/app-hosts"

/**
 * A farm's own web address, from its slug: its shop, or its farm app for a /farm path (src/domain/app-hosts.ts).
 *   with the domain:            https://merryfarms.farmforyou.in, https://merryfarms-farm.farmforyou.in/farm
 *   on the fixed addresses:     https://merry-farms.vercel.app, https://farmforyou-farm.vercel.app/f/<farm>/farm
 *   local development:          http://merryfarms.localhost:3000 (the proxy reads *.localhost the same way)
 *   otherwise (one address):    /f/<farm><path>, which picks the farm for the browser and goes on to <path>.
 */
export function farmUrl(slug: string, path = ""): string {
  const base = appBase(path.startsWith("/farm") ? "farm" : "shop", slug, hostConfigFromEnv(process.env))
  if (base) return `${base}${path}`
  if (process.env.NODE_ENV !== "production") return `http://${slug}.localhost:${process.env.PORT ?? "3000"}${path}`
  return `/f/${slug}${path}`
}

/** FarmForYou admin's address: /admin on the portal's address (farmforyou.in), else /admin here. */
export function adminUrl(): string {
  const base = appBase("portal", null, hostConfigFromEnv(process.env))
  return base ? `${base}/admin` : "/admin"
}

/**
 * Where a support visit opens a farm's app. With the domain, the farm's own farm-app address (the sign-in is shared
 * across farmforyou.in). Before it, the fixed addresses can't share a sign-in, so the visit stays on the portal's
 * address, which shows a farm's app only in support mode.
 */
export function supportFarmUrl(slug: string): string {
  const cfg = hostConfigFromEnv(process.env)
  if (cfg.rootDomain || process.env.NODE_ENV !== "production") return farmUrl(slug, "/farm")
  return `/f/${slug}/farm`
}

/** Where a farm's owner or staff sign in: the farm app's address (any farm's; the sign-in finds theirs). */
export function farmSignInUrl(): string {
  const base = appBase("farm", null, hostConfigFromEnv(process.env))
  return base ? `${base}/login` : "/login"
}

/** A farm's logo wherever it is shown, not only on its own address (admin, Farm For You's home page). */
export function farmLogoUrl(slug: string, logoUrl: string | null): string | null {
  if (!logoUrl) return null
  const v = logoUrl.split("?")[1]
  return `/img/logo?farm=${slug}${v ? `&${v}` : ""}`
}
