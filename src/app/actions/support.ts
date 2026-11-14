"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requirePlatformAdmin } from "@/lib/auth"
import { adminUrl, supportFarmUrl } from "@/lib/farm-url"
import { prisma } from "@/lib/prisma"
import { clearSupportCookie, endVisit, setSupportCookie, startVisit, SUPPORT_COOKIE, visitIdFrom } from "@/server/support"
import { OrderError } from "@/server/orders"
import { adminActor, audit } from "@/server/audit"

/**
 * Super admin: open a farm's app in support mode, with a reason the farm admin will see. Ends after an hour.
 * Returns an error code, or goes straight into the farm app.
 */
export async function startSupportAction(raw: unknown): Promise<{ error: string }> {
  const parsed = z.object({ tenantId: z.string().min(1), reason: z.string().trim().min(3).max(300) }).safeParse(raw)
  if (!parsed.success) return { error: "support_reason" }
  const admin = await requirePlatformAdmin()
  const farm = await prisma.tenant.findUnique({ where: { id: parsed.data.tenantId }, select: { slug: true } })
  if (!farm) return { error: "not_found" }
  try {
    const visit = await startVisit(admin, parsed.data.tenantId, parsed.data.reason)
    await setSupportCookie(visit.id)
    await audit(adminActor(admin), [{ tenantId: parsed.data.tenantId, action: "support.started", subject: visit.id, after: { reason: parsed.data.reason } }])
  } catch (e) {
    if (e instanceof OrderError) return { error: e.code }
    throw e
  }
  redirect(supportFarmUrl(farm.slug))
}

/** Leave support mode: the visit ends now, and the super admin goes back to admin. */
export async function endSupportAction() {
  const id = visitIdFrom((await cookies()).get(SUPPORT_COOKIE)?.value)
  if (id) {
    await endVisit(id)
    const visit = await prisma.supportVisit.findUnique({ where: { id }, select: { tenantId: true, adminId: true, adminName: true } })
    if (visit) await audit({ kind: "platform_admin", id: visit.adminId, name: visit.adminName }, [{ tenantId: visit.tenantId, action: "support.ended", subject: id }])
  }
  await clearSupportCookie()
  redirect(adminUrl())
}
