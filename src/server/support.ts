import "server-only"
import { cache } from "react"
import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { authCookieOptions } from "@/lib/supabase/cookie-options"
import { SUPPORT_MINUTES, summarise, visitOpen, WRITE_OPS } from "@/domain/support"
import { OrderError } from "./orders"

/**
 * Support mode on the server: starting and ending a visit, the cookie that carries it, and the log of changes.
 * The cookie holds the visit's id, signed, so it can't be made up; it is shared across farm addresses like the
 * sign-in cookie. Who may use it is checked in requireStaff (src/lib/auth.ts): the same super admin who started it.
 */
export const SUPPORT_COOKIE = "ffy_support"

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPPORT_SECRET || "ffy-support-local-only"
const sign = (id: string) => createHmac("sha256", secret()).update(`support:${id}`).digest("hex").slice(0, 32)

export function cookieValue(visitId: string) {
  return `${visitId}.${sign(visitId)}`
}

/** The visit id in a cookie value, or null if it was tampered with. */
export function visitIdFrom(value: string | undefined): string | null {
  if (!value) return null
  const dot = value.lastIndexOf(".")
  if (dot < 1) return null
  const id = value.slice(0, dot), sig = Buffer.from(value.slice(dot + 1)), want = Buffer.from(sign(id))
  return sig.length === want.length && timingSafeEqual(sig, want) ? id : null
}

/** A new visit for this super admin on this farm, ending in an hour. */
export async function startVisit(admin: { id: string; authUserId: string; name: string }, tenantId: string, reason: string, now = new Date()) {
  const text = reason.trim()
  if (text.length < 3) throw new OrderError("support_reason")
  if (!(await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new OrderError("not_found")
  return prisma.supportVisit.create({
    data: { tenantId, adminId: admin.id, adminAuthUserId: admin.authUserId, adminName: admin.name, reason: text.slice(0, 300), endsAt: new Date(now.getTime() + SUPPORT_MINUTES * 60_000) },
  })
}

export async function endVisit(visitId: string, now = new Date()) {
  await prisma.supportVisit.updateMany({ where: { id: visitId, endedAt: null }, data: { endedAt: now } })
}

/** The open visit for this farm, if the browser carries one (whoever is signed in; requireStaff checks that). */
export const openVisitFor = cache(async (tenantId: string) => {
  let id: string | null = null
  try {
    id = visitIdFrom((await cookies()).get(SUPPORT_COOKIE)?.value)
  } catch {
    return null // outside a request (scripts, tests)
  }
  if (!id) return null
  const visit = await prisma.supportVisit.findUnique({ where: { id } })
  return visit && visitOpen(visit, tenantId, new Date()) ? visit : null
})

/** Whether the browser carries a support cookie at all (to tell an ended visit from no visit). */
export async function hasSupportCookie() {
  try {
    return !!(await cookies()).get(SUPPORT_COOKIE)
  } catch {
    return false
  }
}

export async function setSupportCookie(visitId: string) {
  ;(await cookies()).set(SUPPORT_COOKIE, cookieValue(visitId), {
    ...authCookieOptions(),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SUPPORT_MINUTES * 60,
  })
}

export async function clearSupportCookie() {
  ;(await cookies()).set(SUPPORT_COOKIE, "", { ...authCookieOptions(), path: "/", maxAge: 0 })
}

/** Logs a write made during a support visit. Never fails the write itself. */
export async function recordChange(tenantId: string, visitId: string, model: string, operation: string, recordId: string | null) {
  try {
    await prisma.supportChange.create({ data: { tenantId, visitId, model, operation, recordId } })
  } catch (e) {
    console.error("[support] could not log a change:", (e as Error).message)
  }
}

/** Called after any write to a farm's data: logs it when it happened inside a support visit. */
export async function noteSupportWrite(tenantId: string, model: string, operation: string, result: unknown) {
  if (!WRITE_OPS.has(operation) || model === "SupportVisit" || model === "SupportChange") return
  const visit = await openVisitFor(tenantId)
  if (!visit) return
  const id = result && typeof result === "object" && "id" in result && typeof (result as { id: unknown }).id === "string" ? (result as { id: string }).id : null
  await recordChange(tenantId, visit.id, model, operation, id)
}

/** A farm's support visits, newest first, each with its changes counted by area. */
export async function listVisits(tenantId: string, take = 20, now = new Date()) {
  const visits = await prisma.supportVisit.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take })
  const changes = visits.length
    ? await prisma.supportChange.findMany({ where: { tenantId, visitId: { in: visits.map((v) => v.id) } }, select: { visitId: true, model: true, operation: true } })
    : []
  return visits.map((v) => {
    const mine = changes.filter((c) => c.visitId === v.id)
    const open = visitOpen(v, tenantId, now)
    // When it finished: Exit, or the hour running out.
    const finishedAt = v.endedAt ?? (open ? null : v.endsAt)
    return { ...v, open, finishedAt, changes: summarise(mine), total: mine.length }
  })
}
