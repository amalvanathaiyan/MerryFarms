import { getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"
import { photoResponse } from "@/server/photos"

/**
 * A product photo: of this address's farm, or ?farm=<slug> where the address isn't the farm's own (admin's
 * Compliance inbox). Photos are public, as in each shop. Links carry ?v=<time of upload>, so phones may keep it long.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const slug = new URL(req.url).searchParams.get("farm")
  const tenant = slug ? await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }) : await getTenant()
  const img = tenant ? await tenantDb(tenant.id).productImage.findFirst({ where: { productId: id } }) : null
  if (!img) return new Response("Not found", { status: 404 })
  return photoResponse(img)
}
