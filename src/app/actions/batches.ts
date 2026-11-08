"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { istDate } from "@/domain/ist"
import { rupeesToPaise } from "@/domain/money"
import { BATCH_PURPOSES, BATCH_SOURCES, LOSS_CAUSES } from "@/domain/batches"
import { createBatch, deleteBatch, saveBatchDay, setBatchClosed, updateBatch } from "@/server/batches"
import { OrderError } from "@/server/orders"

type Result = { ok: true; id?: string } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const count = z.number().int().min(0).max(1_000_000)
const rupees = z.number().min(0).max(10_000_000)
const text = (max: number) => z.string().trim().max(max).optional()
const orNull = (s?: string) => (s ? s : null)

async function farm(roles: Parameters<typeof requireStaff>[0]) {
  const ctx = await requireStaff(roles)
  if (!featuresOf(ctx.tenant).poultryCare) throw new OrderError("feature_off")
  return ctx
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const id = await fn()
    revalidatePath("/farm", "layout")
    return id ? { ok: true, id } : { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

const batchInput = z.object({
  name: text(60),
  breed: text(60),
  purpose: z.enum(BATCH_PURPOSES),
  source: z.enum(BATCH_SOURCES),
  supplier: text(80),
  startDate: ymd,
  ageAtStartDays: z.number().int().min(0).max(3650),
  startCount: z.number().int().min(1).max(1_000_000),
  eggsSet: count.nullable(),
  parentBatchId: z.string().uuid().nullable(),
  eggValueRupees: rupees.nullable(),
  note: text(200),
})

const toBatch = (d: z.infer<typeof batchInput>) => ({
  name: d.name ?? "",
  breed: orNull(d.breed),
  purpose: d.purpose,
  source: d.source,
  supplier: d.source === "bought" ? orNull(d.supplier) : null,
  startDate: d.startDate,
  // Hatched here: the first day is the hatch day.
  ageAtStartDays: d.source === "hatched" ? 0 : d.ageAtStartDays,
  startCount: d.startCount,
  eggsSet: d.source === "hatched" ? d.eggsSet : null,
  parentBatchId: d.source === "hatched" ? d.parentBatchId : null,
  eggValuePaise: d.eggValueRupees != null && d.eggValueRupees > 0 ? rupeesToPaise(d.eggValueRupees) : null,
  note: orNull(d.note),
})

/** Owner: a new batch (bought in or hatched here). */
export async function addBatch(raw: unknown): Promise<Result> {
  const parsed = batchInput.extend({ chicksCostRupees: rupees.nullable() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant, staff } = await farm(OWNER_ONLY)
    const cost = parsed.data.chicksCostRupees
    const batch = await createBatch(tenant.id, staff.id, { ...toBatch(parsed.data), chicksCostPaise: cost ? rupeesToPaise(cost) : null }, istDate(new Date()))
    return batch.id
  })
}

export async function editBatch(id: string, raw: unknown): Promise<Result> {
  const parsed = batchInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant } = await farm(OWNER_ONLY)
    await updateBatch(tenant.id, id, toBatch(parsed.data), istDate(new Date()))
  })
}

export async function closeBatch(id: string, closedDate: string | null): Promise<Result> {
  if (closedDate !== null && !ymd.safeParse(closedDate).success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant } = await farm(OWNER_ONLY)
    await setBatchClosed(tenant.id, id, closedDate, istDate(new Date()))
  })
}

/** Owner: delete a batch. With days entered, its name must be typed to confirm; its own costs go too unless kept. */
export async function removeBatch(id: string, raw: unknown = {}): Promise<Result> {
  const parsed = z.object({ confirmName: z.string().max(80).optional(), keepCosts: z.boolean().optional() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant } = await farm(OWNER_ONLY)
    await deleteBatch(tenant.id, id, parsed.data)
  })
}

const dayInput = z.object({
  date: ymd,
  feedKg: z.number().min(0).max(100_000).nullable(),
  eggsCollected: count.nullable(),
  eggsBroken: count.nullable(),
  sold: count,
  soldRupees: rupees,
  given: count,
  note: text(200),
  losses: z.array(z.object({ cause: z.enum(LOSS_CAUSES), count })).max(LOSS_CAUSES.length * 2),
})

/** Owner and packing staff: one day of one batch. Saving the same day again replaces it. */
export async function saveBatchDayAction(batchId: string, raw: unknown): Promise<Result> {
  const parsed = dayInput.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "record_invalid" }
  return run(async () => {
    const { tenant, staff } = await farm(["owner", "packing"])
    const { soldRupees, note, ...d } = parsed.data
    await saveBatchDay(tenant.id, staff.id, batchId, { ...d, soldPaise: rupeesToPaise(soldRupees), note: orNull(note) }, istDate(new Date()))
  })
}
