import { cache } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"

/**
 * The farm this request is for. The proxy (src/proxy.ts) resolves it from the
 * subdomain (merryfarms.farm4u.in) or DEFAULT_TENANT_SLUG and passes it as x-tenant-slug.
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
