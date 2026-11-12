import { getTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import { photoResponse } from "@/server/photos"

/** A product photo. Links carry ?v=<time of upload>, so phones may keep it for a long time. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenant = await getTenant()
  const img = tenant ? await tenantDb(tenant.id).productImage.findFirst({ where: { productId: id } }) : null
  if (!img) return new Response("Not found", { status: 404 })
  return photoResponse(img)
}
