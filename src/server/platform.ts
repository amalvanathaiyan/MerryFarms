import "server-only"
import { prisma } from "@/lib/prisma"
import { checkSlug, isInvoicePrefix, trialEnd, type FarmStatus } from "@/domain/tenants"
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
