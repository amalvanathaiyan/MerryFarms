"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { istDate } from "@/domain/ist"
import { MAX_WEIGHED } from "@/domain/weights"
import { deleteWeight, saveWeight } from "@/server/weights"
import { OrderError } from "@/server/orders"

type Result = { ok: true } | { ok: false; error: string }

async function run(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn()
    revalidatePath("/farm", "layout")
    return { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

/** The people who keep the batches (owner, manager, packing). */
async function keeper() {
  const ctx = await requireStaff(["owner", "packing"])
  if (!featuresOf(ctx.tenant).poultryCare) throw new OrderError("feature_off")
  return ctx
}

/** A weighing: how many birds, and their weight together in kg (kept in grams). */
export async function saveWeightAction(batchId: string, raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      birds: z.number().int().min(1).max(MAX_WEIGHED),
      totalKg: z.number().positive().max(10_000),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant, staff } = await keeper()
    const d = parsed.data
    await saveWeight(tenant.id, staff.id, batchId, { date: d.date, birds: d.birds, totalGrams: Math.round(d.totalKg * 1000), note: d.note || null }, istDate(new Date()))
  })
}

export async function deleteWeightAction(id: string): Promise<Result> {
  return run(async () => {
    const { tenant } = await keeper()
    await deleteWeight(tenant.id, id)
  })
}
