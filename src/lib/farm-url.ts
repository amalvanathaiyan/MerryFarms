/**
 * A farm's own web address, from its slug: https://merryfarms.farmforyou.in when NEXT_PUBLIC_ROOT_DOMAIN is set;
 * http://merryfarms.localhost:3000 in local development (the proxy reads *.localhost the same way).
 * Without either (one address for every farm, before the domain is bought): /f/<farm><path>, which picks the farm for
 * the browser and goes on to <path> (src/proxy.ts).
 */
export function farmUrl(slug: string, path = ""): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (root) return `https://${slug}.${root}${path}`
  if (process.env.NODE_ENV !== "production") return `http://${slug}.localhost:${process.env.PORT ?? "3000"}${path}`
  return `/f/${slug}${path}`
}

/** FarmForYou admin's address: its own host (admin.farmforyou.in) once farms have their own addresses, else /admin here. */
export function adminUrl(): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  return root ? `https://admin.${root}/admin` : "/admin"
}
