"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { validateSlotRule } from "@/domain/slots"
import { istDate } from "@/domain/ist"
import type { ActionResult } from "./catalogue"

const slotSchema = z.object({
  id: z.string().optional(),
  nameTa: z.string().trim().min(1).max(40),
  nameEn: z.string().trim().min(1).max(40),
  startTime: z.string(),
  endTime: z.string(),
  daysOfWeek: z.array(z.number().int()),
  cutoffHours: z.number().int(),
  maxOrders: z.number().int(),
  isActive: z.boolean(),
})

export async function saveSlot(raw: unknown): Promise<ActionResult> {
  const parsed = slotSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "slot_names_required" }
  const { id, ...data } = parsed.data
  const problem = validateSlotRule(data)
  if (problem) return { ok: false, error: `slot_${problem}` }

  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const clean = { ...data, daysOfWeek: [...new Set(data.daysOfWeek)].sort((a, b) => a - b) }
  if (id) {
    const r = await db.deliverySlot.updateMany({ where: { id }, data: clean })
    if (r.count !== 1) return { ok: false, error: "slot_not_found" }
  } else {
    await db.deliverySlot.create({ data: { ...clean, tenantId: tenant.id } })
  }
  revalidatePath("/farm", "layout")
  revalidatePath("/")
  return { ok: true }
}

export async function deleteSlot(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  // Orders keep their slot label, so the slot row can go. Unlink it from open orders first.
  await db.order.updateMany({ where: { slotId: id }, data: { slotId: null } })
  await db.deliverySlot.deleteMany({ where: { id } })
  revalidatePath("/farm", "layout")
  revalidatePath("/")
  return { ok: true }
}

const closedSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().min(1).nullable(),
  note: z.string().trim().max(60).optional(),
})

/** No deliveries on a day (or in one slot that day). Orders already booked stay; the farm moves them. */
export async function addClosedDay(raw: unknown): Promise<ActionResult> {
  const parsed = closedSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const { date, slotId, note } = parsed.data
  if (date < istDate(new Date())) return { ok: false, error: "date_past" }
  if (slotId && !(await db.deliverySlot.findFirst({ where: { id: slotId } }))) return { ok: false, error: "slot_not_found" }
  const dup = await db.closedDay.findFirst({ where: { date, slotId } })
  if (!dup) await db.closedDay.create({ data: { tenantId: tenant.id, date, slotId, note: note || null } })
  revalidatePath("/farm", "layout")
  revalidatePath("/")
  return { ok: true }
}

export async function removeClosedDay(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  await db.closedDay.deleteMany({ where: { id } })
  revalidatePath("/farm", "layout")
  revalidatePath("/")
  return { ok: true }
}
