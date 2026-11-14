import { getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { photoResponse } from "@/server/photos"

/**
 * A farm's logo: this address's farm, or ?farm=<slug> where the address isn't the farm's own (Farm For You's home
 * page lists every farm). Logos are public, as on each shop. Links carry ?v=<time of upload>, so phones may keep it long.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("farm")
  const tenant = slug ? await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }) : await getTenant()
  const logo = tenant ? await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id } }) : null
  if (!logo) return new Response("Not found", { status: 404 })
  return photoResponse(logo)
}
