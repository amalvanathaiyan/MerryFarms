"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { rupeesToPaise } from "@/domain/money"
import { addHarvest, addSample, addStocking, removeHarvest, closeCycle, removeSample, removeStocking, reopenCycle, saveFishDay, startCycle } from "@/server/fish"
import { OrderError } from "@/server/orders"

type Result = { ok: true; id?: string } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.string().min(1).max(64)
const reading = z.number().min(0).max(100).nullable()

/** Starting cycles, stocking and closing: owner and manager. The day's entry and samples: packing staff too. */
const BOSSES = ["owner"] as const
const HANDS = ["owner", "packing"] as const

async function farm(roles: readonly ("owner" | "packing")[]) {
  const ctx = await requireStaff([...roles])
  if (!featuresOf(ctx.tenant).fishCare) throw new OrderError("feature_off")
  return ctx
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  try {
    const r = await fn()
    revalidatePath("/farm", "layout")
    return r ? { ok: true, id: r } : { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

const stocking = z.object({
  date: ymd,
  species: z.string().trim().min(1).max(40),
  count: z.number().int().min(1).max(10_000_000),
  sizeGrams: z.number().positive().max(10_000).nullable(),
  costRupees: z.number().min(0).max(100_000_000),
  supplier: z.string().trim().max(80).nullable(),
})
const toStocking = ({ costRupees, ...s }: z.infer<typeof stocking>) => ({ ...s, costPaise: rupeesToPaise(costRupees) })

export async function startCycleAction(raw: unknown): Promise<Result> {
  const p = z.object({ placeId: id, note: z.string().trim().max(300).nullable(), stocking }).safeParse(raw)
  if (!p.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db, tenant, staff } = await farm(BOSSES)
    return startCycle(db, tenant.id, { placeId: p.data.placeId, note: p.data.note, stocking: toStocking(p.data.stocking) }, staff.id)
  })
}

export async function addStockingAction(raw: unknown): Promise<Result> {
  const p = z.object({ cycleId: id, stocking }).safeParse(raw)
  if (!p.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db, tenant, staff } = await farm(BOSSES)
    await addStocking(db, tenant.id, p.data.cycleId, toStocking(p.data.stocking), staff.id)
  })
}

export async function removeStockingAction(stockingId: string): Promise<Result> {
  if (!id.safeParse(stockingId).success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db } = await farm(BOSSES)
    await removeStocking(db, stockingId)
  })
}

const day = z.object({
  cycleId: id,
  date: ymd,
  feedKg: z.number().min(0).max(100_000).nullable(),
  feedInputId: id.nullable(),
  dead: z.number().int().min(0).max(10_000_000),
  ph: reading,
  oxygen: reading,
  tempC: reading,
  ammonia: reading,
  note: z.string().trim().max(300).nullable(),
})

export async function saveFishDayAction(raw: unknown): Promise<Result> {
  const p = day.safeParse(raw)
  if (!p.success) return { ok: false, error: "invalid_form" }
  const { cycleId, ...f } = p.data
  return run(async () => {
    const { db, tenant, staff } = await farm(HANDS)
    await saveFishDay(db, tenant.id, cycleId, f, staff.id)
  })
}

export async function addSampleAction(raw: unknown): Promise<Result> {
  const p = z.object({ cycleId: id, date: ymd, species: z.string().trim().max(40).nullable(), count: z.number().int().min(1).max(10_000), totalGrams: z.number().positive().max(10_000_000) }).safeParse(raw)
  if (!p.success) return { ok: false, error: "invalid_form" }
  const { cycleId, ...s } = p.data
  return run(async () => {
    const { db, tenant, staff } = await farm(HANDS)
    await addSample(db, tenant.id, cycleId, { ...s, species: s.species || null }, staff.id)
  })
}

export async function removeSampleAction(sampleId: string): Promise<Result> {
  if (!id.safeParse(sampleId).success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db } = await farm(BOSSES)
    await removeSample(db, sampleId)
  })
}

export async function closeCycleAction(raw: unknown): Promise<Result> {
  const p = z.object({ cycleId: id, date: ymd }).safeParse(raw)
  if (!p.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db } = await farm(BOSSES)
    await closeCycle(db, p.data.cycleId, p.data.date)
  })
}

export async function reopenCycleAction(cycleId: string): Promise<Result> {
  if (!id.safeParse(cycleId).success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db } = await farm(BOSSES)
    await reopenCycle(db, cycleId)
  })
}

/** Fish taken out (sold or kept): the owner and a manager, since it carries money. */
export async function addHarvestAction(raw: unknown): Promise<Result> {
  const p = z
    .object({
      cycleId: id,
      date: ymd,
      species: z.string().trim().max(40).nullable(),
      kg: z.number().positive().max(1_000_000),
      count: z.number().int().min(1).max(10_000_000).nullable(),
      soldRupees: z.number().min(0).max(100_000_000),
      buyer: z.string().trim().max(80).nullable(),
      lastOne: z.boolean(),
    })
    .safeParse(raw)
  if (!p.success) return { ok: false, error: "invalid_form" }
  const { cycleId, soldRupees, lastOne, ...h } = p.data
  return run(async () => {
    const { db, tenant, staff } = await farm(BOSSES)
    await addHarvest(db, tenant.id, cycleId, { ...h, species: h.species || null, soldPaise: rupeesToPaise(soldRupees) }, staff.id, lastOne)
  })
}

export async function removeHarvestAction(harvestId: string): Promise<Result> {
  if (!id.safeParse(harvestId).success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { db } = await farm(BOSSES)
    await removeHarvest(db, harvestId)
  })
}
