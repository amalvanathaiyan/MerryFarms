"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { requireTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { getSessionCustomer } from "@/lib/customer-session"
import { sendFromCustomer, sendFromFarm } from "@/server/chat"
import { OrderError } from "@/server/orders"
import { notifyCustomer, notifyStaff } from "@/server/notify"

type Result = { ok: true } | { ok: false; error: string }
const body = z.string().max(1000)

/** A customer writes to the farm from "My orders" (recognised by the key on their phone). */
export async function customerSend(raw: unknown): Promise<Result> {
  const parsed = z.object({ body, orderId: z.string().optional() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const tenant = await requireTenant()
  if (!featuresOf(tenant).messages) return { ok: false, error: "messages_off" }
  const me = await getSessionCustomer()
  if (!me) return { ok: false, error: "not_connected" }
  try {
    const m = await sendFromCustomer(tenant.id, me.id, parsed.data.body, parsed.data.orderId)
    await notifyStaff(tenant.id, { title: me.name, body: m.body, url: `/farm/messages/${me.id}` })
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  revalidatePath("/my/messages")
  return { ok: true }
}

/** Staff reply from the farm app. */
export async function farmSend(raw: unknown): Promise<Result> {
  const parsed = z.object({ customerId: z.string().min(1), body }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant, staff } = await requireStaff(ORDER_DESK)
  if (!featuresOf(tenant).messages) return { ok: false, error: "messages_off" }
  try {
    const m = await sendFromFarm(tenant.id, parsed.data.customerId, parsed.data.body, staff.id)
    await notifyCustomer(tenant.id, parsed.data.customerId, { title: tenant.nameTa, body: m.body, url: "/my/messages" })
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  revalidatePath("/farm", "layout")
  return { ok: true }
}
