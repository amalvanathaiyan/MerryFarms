import "server-only"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { checkSlug, isInvoicePrefix, suggestInvoicePrefix, trialEnd, type FarmStatus } from "@/domain/tenants"
import { nextStaffCode } from "@/domain/staff"
import { farmUrl } from "@/lib/farm-url"
import { tenantDb } from "@/lib/tenant-db"
import type { Plan } from "@/domain/features"
import { addStaff, resetStaffPassword } from "./staff"
import { OrderError } from "./orders"

/**
 * The FarmForYou platform admin: every farm, across tenants. Only reached through requirePlatformAdmin(),
 * so it uses the plain Prisma client (not tenantDb, which is scoped to one farm).
 */

const DAY = 24 * 60 * 60 * 1000

/** All farms, newest first, with what the admin needs at a glance: plan, trial, size and recent activity. */
export async function listFarms(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY)
  const [farms, orders30, lastOrders, customers, staff] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, nameTa: true, nameEn: true, status: true, plan: true, trialEndsAt: true, phone: true, logoUrl: true, invoicePrefix: true, createdAt: true },
    }),
    prisma.order.groupBy({ by: ["tenantId"], where: { createdAt: { gte: since }, status: { not: "cancelled" } }, _count: { _all: true }, _sum: { totalPaise: true } }),
    prisma.order.groupBy({ by: ["tenantId"], _max: { createdAt: true } }),
    prisma.customer.groupBy({ by: ["tenantId"], _count: { _all: true } }),
    prisma.staffMember.groupBy({ by: ["tenantId"], where: { isActive: true }, _count: { _all: true } }),
  ])
  return farms.map((f) => ({
    ...f,
    orders30: orders30.find((o) => o.tenantId === f.id)?._count._all ?? 0,
    sales30Paise: orders30.find((o) => o.tenantId === f.id)?._sum.totalPaise ?? 0,
    lastOrderAt: lastOrders.find((o) => o.tenantId === f.id)?._max.createdAt ?? null,
    customers: customers.find((c) => c.tenantId === f.id)?._count._all ?? 0,
    staff: staff.find((s) => s.tenantId === f.id)?._count._all ?? 0,
  }))
}

export async function farmDetail(id: string) {
  const farm = await prisma.tenant.findUnique({ where: { id }, omit: { whatsappAccessToken: true } })
  if (!farm) return null
  const staff = await prisma.staffMember.findMany({ where: { tenantId: id }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] })
  const [products, customers, orders] = await Promise.all([
    prisma.product.count({ where: { tenantId: id, deletedAt: null } }),
    prisma.customer.count({ where: { tenantId: id } }),
    prisma.order.count({ where: { tenantId: id } }),
  ])
  return { farm, staff, counts: { products, customers, orders } }
}

export interface NewFarm {
  nameTa: string
  nameEn: string
  slug: string
  phone: string
  defaultLanguage: "ta" | "en"
  invoicePrefix: string
  plan: Plan
  /** 0 = start as a paying (active) farm, no trial. */
  trialDays: number
  owner: { name: string; email: string; phone?: string }
}

/**
 * Adds a farm and its owner's login in one go. The farm starts with one morning delivery slot so its shop
 * can take orders as soon as products are added; the owner changes everything else in their Settings.
 * If the owner's login can't be made, the half-made farm is removed again.
 */
export async function createFarm(input: NewFarm, now = new Date()) {
  const slugProblem = checkSlug(input.slug)
  if (slugProblem) throw new OrderError(slugProblem)
  if (!isInvoicePrefix(input.invoicePrefix)) throw new OrderError("invoice_prefix")
  if (await prisma.tenant.findUnique({ where: { slug: input.slug }, select: { id: true } })) throw new OrderError("slug_taken")

  const tenant = await prisma.tenant.create({
    data: {
      slug: input.slug,
      nameTa: input.nameTa,
      nameEn: input.nameEn,
      phone: input.phone,
      whatsappNumber: input.phone,
      defaultLanguage: input.defaultLanguage,
      invoicePrefix: input.invoicePrefix,
      plan: input.plan,
      status: input.trialDays > 0 ? "trial" : "active",
      trialEndsAt: input.trialDays > 0 ? trialEnd(now, input.trialDays) : null,
      settings: { create: {} },
      slots: { create: { nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 20 } },
    },
  })
  try {
    const { member, password } = await addStaff(tenant.id, { ...input.owner, roles: ["owner"] })
    return { tenant, owner: member, password }
  } catch (e) {
    await prisma.tenant.delete({ where: { id: tenant.id } })
    throw e
  }
}

/** A farm registering itself gets the free plan with the same trial the admin form starts with. */
export const SIGNUP_TRIAL_DAYS = 30

/** Stored on the Supabase login at sign-up, so the farm can be made once the email is confirmed. */
export const farmSignup = z.object({
  ownerName: z.string().trim().min(1).max(60),
  nameTa: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  slug: z.string().trim().toLowerCase().max(30),
  phone: z.string().trim().min(10).max(20),
  defaultLanguage: z.enum(["ta", "en"]),
})
export type FarmSignup = z.infer<typeof farmSignup>

/** The name may have been taken while the email was waiting to be confirmed. */
async function freeSlug(slug: string) {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? slug : `${slug.slice(0, 27)}-${n}`
    if (!(await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate
  }
}

/**
 * Makes the farm for an owner who registered themselves. Safe to call twice: the email-confirm link and a later
 * sign-in both call it, and a login already on a farm gets no second one.
 */
export async function provisionSignup(authUserId: string, email: string, signup: FarmSignup, now = new Date()) {
  const already = await prisma.staffMember.findFirst({ where: { authUserId }, select: { tenant: { select: { slug: true } } } })
  if (already) return already.tenant.slug
  const slugProblem = checkSlug(signup.slug)
  if (slugProblem) throw new OrderError(slugProblem)
  const slug = await freeSlug(signup.slug)
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      nameTa: signup.nameTa,
      nameEn: signup.nameEn,
      phone: signup.phone,
      whatsappNumber: signup.phone,
      defaultLanguage: signup.defaultLanguage,
      invoicePrefix: suggestInvoicePrefix(signup.nameEn),
      plan: "free",
      status: "trial",
      trialEndsAt: trialEnd(now, SIGNUP_TRIAL_DAYS),
      settings: { create: {} },
      slots: { create: { nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 20 } },
    },
  })
  await tenantDb(tenant.id).staffMember.create({
    data: { tenantId: tenant.id, authUserId, staffCode: nextStaffCode(slug, []), name: signup.ownerName, email: email.toLowerCase(), phone: signup.phone, roles: ["owner"] },
  })
  return slug
}

/** Finishes a sign-up left waiting on a login's metadata, if there is one. */
export async function provisionFromMetadata(authUserId: string, email: string, metadata: unknown) {
  const signup = farmSignup.safeParse((metadata as { farmSignup?: unknown } | null)?.farmSignup)
  return signup.success ? provisionSignup(authUserId, email, signup.data) : null
}

/**
 * Where someone goes after signing in. Hotelier-4U sends super_admin to /admin and everyone else to their dashboard;
 * here a farm is chosen by address, so staff signed in on another farm's address are sent to their own.
 */
export async function homeAfterSignIn(authUserId: string, hostTenantId: string | undefined, next?: string) {
  const wanted = next?.startsWith("/farm") || next?.startsWith("/admin") ? next : "/farm"
  const admin = await prisma.platformAdmin.findUnique({ where: { authUserId }, select: { id: true } })
  if (wanted.startsWith("/admin") && admin) return wanted
  const farms = await prisma.staffMember.findMany({ where: { authUserId, isActive: true }, select: { tenantId: true, tenant: { select: { slug: true } } } })
  if (farms.some((f) => f.tenantId === hostTenantId)) return wanted.startsWith("/admin") ? "/farm" : wanted
  if (admin) return "/admin"
  return farms[0] ? (farmUrl(farms[0].tenant.slug, "/farm") ?? "/farm") : "/farm"
}

export interface FarmChanges {
  nameTa: string
  nameEn: string
  phone: string
  invoicePrefix: string
  defaultLanguage: "ta" | "en"
  plan: Plan
  status: FarmStatus
  /** "YYYY-MM-DD" or null; only kept while on trial. */
  trialEndsOn: string | null
}

export async function updateFarm(id: string, c: FarmChanges) {
  if (!isInvoicePrefix(c.invoicePrefix)) throw new OrderError("invoice_prefix")
  const farm = await prisma.tenant.findUnique({ where: { id }, select: { id: true } })
  if (!farm) throw new OrderError("not_found")
  await prisma.tenant.update({
    where: { id },
    data: {
      nameTa: c.nameTa,
      nameEn: c.nameEn,
      phone: c.phone,
      invoicePrefix: c.invoicePrefix,
      defaultLanguage: c.defaultLanguage,
      plan: c.plan,
      status: c.status,
      trialEndsAt: c.status === "trial" && c.trialEndsOn ? new Date(`${c.trialEndsOn}T23:59:59+05:30`) : null,
    },
  })
}

/** Another owner (or the first one, for a farm added without). */
export async function addOwner(tenantId: string, owner: { name: string; email: string; phone?: string }) {
  if (!(await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new OrderError("not_found")
  return addStaff(tenantId, { ...owner, roles: ["owner"] })
}

/** A new temporary password for any of a farm's staff (e.g. the owner forgot theirs). */
export async function resetPassword(tenantId: string, staffId: string) {
  return resetStaffPassword(tenantId, staffId)
}
