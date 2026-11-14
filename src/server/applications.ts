import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { AGREEMENT_VERSION, cleanChecklist, detailsProblem, isOpen, OPEN_STATES, MAX_PER_SOURCE_PER_DAY, missingChecks, needsReply, nextStates, type ApplicationState } from "@/domain/applications"
import { isModuleKey } from "@/domain/modules"
import { OrderError } from "./orders"
import { emitEvent } from "./events"
import { audit, type Actor } from "./audit"

/**
 * Farms that register themselves from the home page, and the Farm For You team's review (docs/platform-plan.md §3.8).
 * Rules are in src/domain/applications.ts. Approving happens when admin adds the farm from the application
 * (createFarmAction with an applicationId), so a farm is only ever made in one place.
 */

const DAY = 24 * 60 * 60 * 1000

export interface ApplicationInput {
  ownerName: string
  /** +91XXXXXXXXXX, already checked */
  phone: string
  email: string
  nameTa: string
  nameEn: string | null
  modules: string[]
  district: string
  address: string
  pincode: string
  lat: number | null
  lng: number | null
  fssai: string | null
  gstin: string | null
  pan: string | null
  planId: string | null
  message: string | null
  language: "ta" | "en"
}

/**
 * Saves a farm's application. One open application per mobile number: sending again returns the one already made.
 * At most a few a day from one place, so the form can't be flooded.
 */
export async function submitApplication(input: ApplicationInput, sourceHash: string | null, now = new Date()): Promise<{ number: number; again: boolean }> {
  const email = input.email.trim().toLowerCase()
  const fssai = input.fssai?.replace(/\s/g, "") || null
  const gstin = input.gstin?.replace(/\s/g, "").toUpperCase() || null
  const pan = input.pan?.replace(/\s/g, "").toUpperCase() || null
  const problem = detailsProblem({ email, pincode: input.pincode, fssai, gstin, pan })
  if (problem) throw new OrderError(`application_${problem}`)

  const open = await prisma.farmApplication.findFirst({ where: { phone: input.phone, status: { in: [...OPEN_STATES] } }, select: { number: true } })
  if (open) return { number: open.number, again: true }
  if (sourceHash && (await prisma.farmApplication.count({ where: { sourceHash, createdAt: { gte: new Date(now.getTime() - DAY) } } })) >= MAX_PER_SOURCE_PER_DAY) throw new OrderError("too_many_tries")

  const plan = input.planId ? await prisma.platformPlan.findFirst({ where: { id: input.planId, isPublic: true, retired: false }, select: { id: true } }) : null
  for (let attempt = 0; ; attempt++) {
    const last = await prisma.farmApplication.findFirst({ orderBy: { number: "desc" }, select: { number: true } })
    try {
      const a = await prisma.farmApplication.create({
        data: {
          number: (last?.number ?? 0) + 1,
          ownerName: input.ownerName.trim(),
          phone: input.phone,
          email,
          nameTa: input.nameTa.trim(),
          nameEn: input.nameEn?.trim() || null,
          modules: [...new Set(input.modules.filter(isModuleKey))],
          district: input.district.trim(),
          address: input.address.trim(),
          pincode: input.pincode,
          lat: input.lat,
          lng: input.lng,
          fssai,
          gstin,
          pan,
          planId: plan?.id ?? null,
          message: input.message?.trim() || null,
          language: input.language,
          agreementVersion: AGREEMENT_VERSION,
          agreedAt: now,
          sourceHash,
        },
      })
      await emitEvent("application.received", null, { applicationId: a.id, number: a.number, nameTa: a.nameTa, district: a.district })
      return { number: a.number, again: false }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 5) continue
      throw e
    }
  }
}

/** Every application, newest first, with the plan the farm liked. */
export async function listApplications() {
  const [rows, plans] = await Promise.all([prisma.farmApplication.findMany({ orderBy: { createdAt: "desc" } }), prisma.platformPlan.findMany({ select: { id: true, nameTa: true, nameEn: true } })])
  return rows.map((a) => ({ ...a, plan: plans.find((p) => p.id === a.planId) ?? null }))
}

export const openApplicationsCount = () => prisma.farmApplication.count({ where: { status: { in: [...OPEN_STATES] } } })

export async function applicationDetail(id: string) {
  const a = await prisma.farmApplication.findUnique({ where: { id } })
  if (!a) return null
  const [plan, farm, earlier] = await Promise.all([
    a.planId ? prisma.platformPlan.findUnique({ where: { id: a.planId }, select: { id: true, nameTa: true, nameEn: true, trialDays: true } }) : null,
    a.tenantId ? prisma.tenant.findUnique({ where: { id: a.tenantId }, select: { id: true, nameTa: true, nameEn: true } }) : null,
    // The same mobile applying before, or already a farm's number
    prisma.farmApplication.findMany({ where: { phone: a.phone, id: { not: a.id } }, orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, createdAt: true } }),
  ])
  const sameFarmPhone = await prisma.tenant.findFirst({ where: { phone: a.phone }, select: { id: true, nameTa: true, nameEn: true } })
  return { ...a, plan, farm, earlier, sameFarmPhone }
}

/** The reviewer's checklist and own notes. */
export async function saveReview(id: string, review: { checklist: unknown; notes: string | null }, actor: Actor) {
  const a = await prisma.farmApplication.findUnique({ where: { id } })
  if (!a) throw new OrderError("not_found")
  const checklist = cleanChecklist(review.checklist)
  const notes = review.notes?.trim() || null
  // Opening it to check things starts the review
  const status = a.status === "applied" ? "reviewing" : a.status
  await prisma.farmApplication.update({ where: { id }, data: { checklist, notes, status, reviewedBy: actor.name } })
  await audit(actor, [{ tenantId: null, action: "application.checked", subject: id, before: { checklist: a.checklist, notes: a.notes }, after: { checklist, notes } }])
}

/** Moves an application on: under review, more details needed, on hold, turned down, or opened again. */
export async function moveApplication(id: string, to: ApplicationState, reply: string | null, actor: Actor, now = new Date()) {
  const a = await prisma.farmApplication.findUnique({ where: { id } })
  if (!a) throw new OrderError("not_found")
  if (!nextStates(a.status).includes(to)) throw new OrderError("invalid_form")
  const text = reply?.trim() || null
  if (needsReply(to) && !text) throw new OrderError("reply_needed")
  await prisma.farmApplication.update({
    where: { id },
    data: { status: to, reply: needsReply(to) ? text : a.reply, reviewedBy: actor.name, decidedAt: to === "rejected" ? now : null },
  })
  await audit(actor, [{ tenantId: null, action: `application.${to}`, subject: id, before: { status: a.status }, after: { status: to, reply: text } }])
  await emitEvent(`application.${to}`, null, { applicationId: id, number: a.number })
}

/** Before admin adds the farm from an application: it must still be open, with the phone and location checked. */
export async function applicationToApprove(id: string) {
  const a = await prisma.farmApplication.findUnique({ where: { id } })
  if (!a || !isOpen(a.status)) throw new OrderError("application_closed")
  if (missingChecks(a.checklist).length > 0) throw new OrderError("application_not_checked")
  return a
}

/** The farm was added from it: approved, linked to the farm. */
export async function markApproved(id: string, tenantId: string, actor: Actor, now = new Date()) {
  await prisma.farmApplication.update({ where: { id }, data: { status: "approved", tenantId, decidedAt: now, reviewedBy: actor.name } })
  await audit(actor, [{ tenantId, action: "application.approved", subject: id, after: { tenantId } }])
  await emitEvent("application.approved", tenantId, { applicationId: id })
}
