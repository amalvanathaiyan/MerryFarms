"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { OrderError, recordCall, setOrderStatus } from "@/server/orders"

const statusSchema = z.object({
  orderId: z.string().min(1),
  // Delivery is separate (actions/billing.ts) because it issues the invoice and records payment.
  to: z.enum(["confirmed", "packed", "out_for_delivery", "cancelled"]),
  note: z.string().trim().max(200).optional(),
})

export async function changeOrderStatus(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = statusSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  // Packing and delivery staff may move orders forward; only the order desk confirms or cancels.
  const needsDesk = parsed.data.to === "confirmed" || parsed.data.to === "cancelled"
  const { tenant, staff } = await requireStaff(needsDesk ? ORDER_DESK : undefined)
  try {
    await setOrderStatus(tenant.id, parsed.data.orderId, parsed.data.to, staff.id, parsed.data.note)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  revalidatePath("/farm", "layout")
  return { ok: true }
}

const callSchema = z.object({
  orderId: z.string().min(1),
  outcome: z.enum(["confirmed", "changed", "cancelled", "no_answer", "wrong_number"]),
  note: z.string().trim().max(200).optional(),
})

export async function logCall(raw: unknown): Promise<{ ok: boolean; error?: string; retry?: boolean; needsOwner?: boolean }> {
  const parsed = callSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant, staff } = await requireStaff(ORDER_DESK)
  try {
    const r = await recordCall(tenant.id, parsed.data.orderId, parsed.data.outcome, staff.id, parsed.data.note)
    revalidatePath("/farm", "layout")
    return { ok: true, retry: r.retry, needsOwner: r.needsOwner }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}
