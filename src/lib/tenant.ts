import { cache } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

/**
 * The farm this request is for. The proxy (src/proxy.ts) resolves it from the
 * subdomain (merryfarms.farmforyou.in) or DEFAULT_TENANT_SLUG and passes it as x-tenant-slug.
 */
export const getTenant = cache(async () => {
  const slug = (await headers()).get("x-tenant-slug")
  if (!slug) return null
  // Secrets are never loaded with the farm record, so they can't reach a page or the browser
  // (React's development tools serialise awaited values). Fetch them on purpose where needed.
  return prisma.tenant.findUnique({ where: { slug }, omit: { whatsappAccessToken: true } })
})

export async function requireTenant() {
  const tenant = await getTenant()
  if (!tenant) notFound()
  return tenant
}

export type Tenant = NonNullable<Awaited<ReturnType<typeof getTenant>>>

/** False only on the platform's main address with farms on subdomains: there, staff must say which farm they are from. */
export async function farmKnownFromAddress() {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase()
  if (!root) return true
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase()
  return host.endsWith(`.${root}`) && host !== `www.${root}` && host !== `admin.${root}`
}
