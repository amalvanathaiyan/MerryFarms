"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { istDate } from "@/domain/ist"
import { rupeesToPaise } from "@/domain/money"
import { VACCINE_METHODS } from "@/domain/vaccinations"
import { addDose, addScheduleItem, applyScheduleToBatch, deleteDose, deleteScheduleItem, giveDose, undoDose } from "@/server/vaccinations"
import { OrderError } from "@/server/orders"

type Result = { ok: true; added?: number } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const method = z.enum(VACCINE_METHODS).nullable()
const birds = z.number().int().min(0).max(1_000_000).nullable()
const rupees = z.number().min(0).max(10_000_000).nullable()
const note = z.string().trim().max(200).optional()

async function poultry(roles: Parameters<typeof requireStaff>[0]) {
  const ctx = await requireStaff(roles)
  if (!featuresOf(ctx.tenant).poultryCare) throw new OrderError("feature_off")
  return { ...ctx, isOwner: ctx.staff.roles.includes("owner") }
}

async function run(fn: () => Promise<number | void>): Promise<Result> {
  try {
    const added = await fn()
    revalidatePath("/farm", "layout")
    return typeof added === "number" ? { ok: true, added } : { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

/** Only the owner sees and sets money; for staff a cost is left as it is. */
const costFor = (isOwner: boolean, r: number | null) => (isOwner ? (r && r > 0 ? rupeesToPaise(r) : null) : undefined)

/** Owner: one line of the farm's vaccine plan. */
export async function addScheduleItemAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ vaccine: z.string().trim().min(1).max(60), ageDays: z.number().int().min(0).max(3650), method }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant } = await poultry(OWNER_ONLY)
    await addScheduleItem(tenant.id, parsed.data)
  })
}

export async function deleteScheduleItemAction(id: string): Promise<Result> {
  return run(async () => {
    const { tenant } = await poultry(OWNER_ONLY)
    await deleteScheduleItem(tenant.id, id)
  })
}

/** Owner: put the farm's plan (doses from today on) on a batch that came before the plan was set. */
export async function applyScheduleAction(batchId: string): Promise<Result> {
  return run(async () => {
    const { tenant } = await poultry(OWNER_ONLY)
    return applyScheduleToBatch(tenant.id, batchId, istDate(new Date()))
  })
}

/** Owner and packing staff: plan a dose for a batch, or enter one already given. */
export async function addDoseAction(batchId: string, raw: unknown): Promise<Result> {
  const parsed = z
    .object({ vaccine: z.string().trim().min(1).max(60), method, dueDate: ymd.nullable(), givenDate: ymd.nullable(), birds, costRupees: rupees, note })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant, staff, isOwner } = await poultry(["owner", "packing"])
    const d = parsed.data
    await addDose(tenant.id, staff.id, batchId, { vaccine: d.vaccine, method: d.method, dueDate: d.dueDate, givenDate: d.givenDate, birds: d.givenDate ? d.birds : null, costPaise: d.givenDate ? costFor(isOwner, d.costRupees) : null, note: d.note || null }, istDate(new Date()))
  })
}

/** Owner and packing staff: mark a dose given (or change the day, birds, cost). */
export async function giveDoseAction(id: string, raw: unknown): Promise<Result> {
  const parsed = z.object({ givenDate: ymd, birds, costRupees: rupees, note }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant, staff, isOwner } = await poultry(["owner", "packing"])
    const d = parsed.data
    await giveDose(tenant.id, staff.id, id, { givenDate: d.givenDate, birds: d.birds, costPaise: costFor(isOwner, d.costRupees), note: d.note || null }, istDate(new Date()))
  })
}

export async function undoDoseAction(id: string): Promise<Result> {
  return run(async () => {
    const { tenant } = await poultry(["owner", "packing"])
    await undoDose(tenant.id, id)
  })
}

export async function deleteDoseAction(id: string): Promise<Result> {
  return run(async () => {
    const { tenant } = await poultry(OWNER_ONLY)
    await deleteDose(tenant.id, id)
  })
}
