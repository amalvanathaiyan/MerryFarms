"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { istDate } from "@/domain/ist"
import { rupeesToPaise } from "@/domain/money"
import { checkDayRecord, EXPENSE_KINDS } from "@/domain/records"

type Result = { ok: true } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const count = z.number().int().min(0).max(10_000_000).nullable()

/** One day's flock figures; saving again the same day updates it. Owner and packing staff. */
export async function saveDayRecord(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ date: ymd, eggsCollected: count, eggsBroken: count, birds: count, birdsLost: count, feedKg: z.number().min(0).max(100_000).nullable(), note: z.string().trim().max(200).optional() })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "record_invalid" }
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  if (!featuresOf(tenant).farmRecords) return { ok: false, error: "feature_off" }
  const { date, note, ...figures } = parsed.data
  if (date > istDate(new Date())) return { ok: false, error: "record_future" }
  const problem = checkDayRecord(figures)
  if (problem) return { ok: false, error: problem }
  await db.dailyRecord.upsert({
    where: { tenantId_date: { tenantId: tenant.id, date } },
    update: { ...figures, note: note || null, byStaffId: staff.id },
    create: { tenantId: tenant.id, date, ...figures, note: note || null, byStaffId: staff.id },
  })
  revalidatePath("/farm", "layout")
  return { ok: true }
}

export async function addExpense(raw: unknown): Promise<Result> {
  const parsed = z.object({ date: ymd, kind: z.enum(EXPENSE_KINDS), amountRupees: z.number().positive().max(10_000_000), note: z.string().trim().max(120).optional() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(OWNER_ONLY)
  if (!featuresOf(tenant).farmRecords) return { ok: false, error: "feature_off" }
  if (parsed.data.date > istDate(new Date())) return { ok: false, error: "record_future" }
  await db.expense.create({
    data: { tenantId: tenant.id, date: parsed.data.date, kind: parsed.data.kind, amountPaise: rupeesToPaise(parsed.data.amountRupees), note: parsed.data.note || null, byStaffId: staff.id },
  })
  revalidatePath("/farm", "layout")
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<Result> {
  const { db } = await requireStaff(OWNER_ONLY)
  await db.expense.deleteMany({ where: { id } })
  revalidatePath("/farm", "layout")
  return { ok: true }
}
