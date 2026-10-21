"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { validateSlotRule } from "@/domain/slots"
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
