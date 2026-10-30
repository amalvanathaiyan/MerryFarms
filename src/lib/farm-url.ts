/**
 * A farm's own web address, from its slug: https://merryfarms.farmforyou.in when NEXT_PUBLIC_ROOT_DOMAIN is set;
 * http://merryfarms.localhost:3000 in local development (the proxy reads *.localhost the same way).
 * Without either, farms can't be told apart by address (single-farm launch), so there is no link.
 */
export function farmUrl(slug: string, path = ""): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (root) return `https://${slug}.${root}${path}`
  if (process.env.NODE_ENV !== "production") return `http://${slug}.localhost:${process.env.PORT ?? "3000"}${path}`
  return null
}
