"use server"

import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { requireTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { getSessionCustomer } from "@/lib/customer-session"
import { saveSubscription } from "@/server/notify"

const schema = z.object({
  who: z.enum(["customer", "staff"]),
  subscription: z.object({
    endpoint: z.string().url().max(1000).startsWith("https://"),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
})

/** Remembers this phone so the farm (or the customer) can be notified on it. */
export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { who, subscription: s } = parsed.data
  const sub = { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }

  if (who === "staff") {
    const { tenant, staff } = await requireStaff()
    if (!featuresOf(tenant).pushNotifications) return { ok: false, error: "off" }
    await saveSubscription(tenant.id, { staffId: staff.id }, sub)
    return { ok: true }
  }
  const tenant = await requireTenant()
  if (!featuresOf(tenant).pushNotifications) return { ok: false, error: "off" }
  const me = await getSessionCustomer()
  if (!me) return { ok: false, error: "not_connected" }
  await saveSubscription(tenant.id, { customerId: me.id }, sub)
  return { ok: true }
}
