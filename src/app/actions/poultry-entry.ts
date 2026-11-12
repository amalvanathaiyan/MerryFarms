"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { istDate } from "@/domain/ist"
import { rupeesToPaise } from "@/domain/money"
import { LOSS_CAUSES } from "@/domain/batches"
import { VACCINE_METHODS } from "@/domain/vaccinations"
import { MAX_WEIGHED } from "@/domain/weights"
import { saveBatchEntry, type BatchEntryResult } from "@/server/poultry-entry"
import { staffActor } from "@/server/audit"
import { OrderError } from "@/server/orders"

const count = z.number().int().min(0).max(1_000_000)
const rupees = z.number().min(0).max(10_000_000).nullable()
const birds = count.nullable()

const entrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: z
    .object({
      feedKg: z.number().min(0).max(100_000).nullable(),
      eggsCollected: count.nullable(),
      eggsBroken: count.nullable(),
      sold: count,
      soldRupees: z.number().min(0).max(10_000_000),
      given: count,
      note: z.string().trim().max(200).optional(),
      losses: z.array(z.object({ cause: z.enum(LOSS_CAUSES), count })).max(LOSS_CAUSES.length * 2),
    })
    .optional(),
  weight: z.object({ birds: z.number().int().min(1).max(MAX_WEIGHED), totalKg: z.number().positive().max(10_000), note: z.string().trim().max(200).optional() }).optional(),
  give: z.array(z.object({ doseId: z.string().uuid(), birds, costRupees: rupees })).max(30).optional(),
  newDose: z.object({ vaccine: z.string().trim().min(1).max(60), method: z.enum(VACCINE_METHODS).nullable(), birds, costRupees: rupees }).optional(),
})

type Result = ({ ok: true } & BatchEntryResult) | { ok: false; error: string }

/**
 * Owner and packing staff: everything entered for one batch on one day, with one Save (the Entry page). Only the
 * owner sets money: for staff a dose's cost is left as it is.
 */
export async function saveBatchEntryAction(batchId: string, raw: unknown): Promise<Result> {
  const parsed = entrySchema.safeParse(raw)
  if (!parsed.success || !z.string().uuid().safeParse(batchId).success) return { ok: false, error: "record_invalid" }
  const d = parsed.data
  try {
    const { tenant, staff, support } = await requireStaff(["owner", "packing"])
    if (!featuresOf(tenant).poultryCare) throw new OrderError("feature_off")
    const isOwner = staff.roles.includes("owner")
    const cost = (r: number | null) => (isOwner ? (r && r > 0 ? rupeesToPaise(r) : null) : undefined)
    const res = await saveBatchEntry(
      tenant.id,
      { ...staffActor(staff, support), id: staff.id },
      batchId,
      {
        date: d.date,
        day: d.day && (({ soldRupees, note, ...x }) => ({ ...x, soldPaise: rupeesToPaise(soldRupees), note: note || null }))(d.day),
        weight: d.weight && { birds: d.weight.birds, totalGrams: Math.round(d.weight.totalKg * 1000), note: d.weight.note || null },
        give: d.give?.map((g) => ({ doseId: g.doseId, birds: g.birds, costPaise: cost(g.costRupees) })),
        newDose: d.newDose && { vaccine: d.newDose.vaccine, method: d.newDose.method, birds: d.newDose.birds, costPaise: cost(d.newDose.costRupees) },
      },
      istDate(new Date()),
      featuresOf(tenant).stockTracking
    )
    if (res.saved.length) revalidatePath("/farm", "layout")
    return { ok: true, ...res }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}
