"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { istDate } from "@/domain/ist"
import { rupeesToPaise } from "@/domain/money"
import { EXPENSE_KINDS, MAX_SPREAD_MONTHS } from "@/domain/records"
import { saveProduction } from "@/server/production"
import { OrderError } from "@/server/orders"

type Result = { ok: true } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Owner: money spent. Feed can carry its kg, which fills the feed store and prices the feed each batch eats.
 * Other spending can be put on one batch (chicks, medicine); feed never is, because a batch's feed cost comes
 * from what it ate, and counting the purchase too would count it twice. A big cost (a shed, equipment) can be
 * spread over months, so profit counts a share of it each month instead of all of it on the day it was paid.
 */
export async function addExpense(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      date: ymd,
      kind: z.enum(EXPENSE_KINDS),
      amountRupees: z.number().positive().max(10_000_000),
      quantityKg: z.number().positive().max(1_000_000).nullable().optional(),
      batchId: z.string().uuid().nullable().optional(),
      spreadMonths: z.number().int().min(2).max(MAX_SPREAD_MONTHS).nullable().optional(),
      note: z.string().trim().max(120).optional(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  if (!featuresOf(tenant).farmRecords) return { ok: false, error: "feature_off" }
  const isOwner = staff.roles.includes("owner")
  const d = parsed.data
  if (d.date > istDate(new Date())) return { ok: false, error: "record_future" }
  // Feed kg and batches belong to poultry care; without it, an expense is just an amount.
  const poultry = featuresOf(tenant).poultryCare
  // Feed is never spread: it is priced by what each batch eats. A spread cost is the whole farm's, never one batch's.
  // Spreading changes how profit counts a cost, so only the owner decides it.
  const spreadMonths = d.kind === "feed" || !isOwner ? null : (d.spreadMonths ?? null)
  const batchId = !poultry || d.kind === "feed" || spreadMonths ? null : (d.batchId ?? null)
  if (batchId && !(await db.batch.findFirst({ where: { id: batchId }, select: { id: true } }))) return { ok: false, error: "batch_not_found" }
  await db.expense.create({
    data: {
      tenantId: tenant.id,
      date: d.date,
      kind: d.kind,
      amountPaise: rupeesToPaise(d.amountRupees),
      quantityKg: poultry && d.kind === "feed" ? (d.quantityKg ?? null) : null,
      batchId,
      spreadMonths,
      note: d.note || null,
      byStaffId: staff.id,
    },
  })
  revalidatePath("/farm", "layout")
  return { ok: true }
}

/** The owner can delete any expense; a manager only the ones they entered. */
export async function deleteExpense(id: string): Promise<Result> {
  const { db, staff } = await requireStaff(["owner", "manager"])
  const isOwner = staff.roles.includes("owner")
  const { count } = await db.expense.deleteMany({ where: isOwner ? { id } : { id, byStaffId: staff.id } })
  if (count === 0 && !isOwner) return { ok: false, error: "not_your_expense" }
  revalidatePath("/farm", "layout")
  return { ok: true }
}

/** What was made or collected today, per product; good quantity can go into stock. */
export async function saveProductionAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      date: ymd,
      entries: z.array(z.object({ productId: z.string().min(1), made: z.number().min(0).max(10_000_000), wasted: z.number().min(0).max(10_000_000) })).min(1).max(200),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "record_invalid" }
  const { tenant, staff } = await requireStaff(["owner", "packing"])
  const features = featuresOf(tenant)
  if (!features.farmRecords) return { ok: false, error: "feature_off" }
  if (parsed.data.date > istDate(new Date())) return { ok: false, error: "record_future" }
  try {
    await saveProduction(tenant.id, staff.id, parsed.data.date, parsed.data.entries, features.stockTracking)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  revalidatePath("/farm", "layout")
  return { ok: true }
}
