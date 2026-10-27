"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { processReturn } from "@/server/returns"
import { OrderError } from "@/server/orders"

const schema = z.object({
  orderId: z.string().min(1),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(0).max(500) })).max(40),
  reason: z.enum(["damaged", "short_delivered", "returned", "quality", "other"]),
  note: z.string().trim().max(300).optional(),
  refundMethod: z.enum(["account", "cash", "upi"]),
  restock: z.boolean(),
  refundDeliveryFee: z.boolean(),
})

export async function submitReturn(raw: unknown): Promise<{ ok: true; creditNoteId?: string } | { ok: false; error: string }> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { orderId, ...input } = parsed.data
  const { tenant, staff } = await requireStaff(ORDER_DESK)
  try {
    const { creditNote } = await processReturn(tenant.id, orderId, input, staff.id)
    revalidatePath("/farm", "layout")
    return { ok: true, creditNoteId: creditNote?.id }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}
