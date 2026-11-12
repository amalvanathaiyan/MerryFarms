import { getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { photoResponse } from "@/server/photos"

/** This farm's logo (the farm comes from the address). Links carry ?v=<time of upload>, so phones may keep it long. */
export async function GET() {
  const tenant = await getTenant()
  const logo = tenant ? await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id } }) : null
  if (!logo) return new Response("Not found", { status: 404 })
  return photoResponse(logo)
}
