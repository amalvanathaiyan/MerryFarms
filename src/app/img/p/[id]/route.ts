import { getTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"

/** A product photo. Links carry ?v=<time of upload>, so phones may keep it for a long time. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tenant = await getTenant()
  const img = tenant ? await tenantDb(tenant.id).productImage.findFirst({ where: { productId: id } }) : null
  if (!img) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(img.data), {
    headers: {
      "content-type": img.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  })
}
