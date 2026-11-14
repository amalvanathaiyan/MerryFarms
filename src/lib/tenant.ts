import { cache } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { hostConfigFromEnv, readHost } from "@/domain/app-hosts"

/**
 * The farm this request is for. The proxy (src/proxy.ts) resolves it from the subdomain
 * (merryfarms.farmforyou.in, merryfarms-farm.farmforyou.in), a /f/<farm> link, or DEFAULT_TENANT_SLUG, and passes it as x-tenant-slug.
 */
export const getTenant = cache(async () => {
  const h = await headers()
  const slug = h.get("x-tenant-slug")
  if (!slug) return null
  // Secrets are never loaded with the farm record, so they can't reach a page or the browser
  // (React's development tools serialise awaited values). Fetch them on purpose where needed.
  const farm = await prisma.tenant.findUnique({ where: { slug }, omit: { whatsappAccessToken: true } })
  // A farm chosen by an old /f/<farm> link that no longer exists: the default farm instead
  const fallback = h.get("x-tenant-fallback")
  if (!farm && fallback && fallback !== slug) return prisma.tenant.findUnique({ where: { slug: fallback }, omit: { whatsappAccessToken: true } })
  return farm
})

export async function requireTenant() {
  const tenant = await getTenant()
  if (!tenant) notFound()
  return tenant
}

export type Tenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>

/** False only on the platform's main address with farms on subdomains: there, staff must say which farm they are from. */
export async function farmKnownFromAddress() {
  const cfg = hostConfigFromEnv(process.env)
  if (!cfg.rootDomain) return true
  return readHost((await headers()).get("host") ?? "", cfg).slug !== null
}
