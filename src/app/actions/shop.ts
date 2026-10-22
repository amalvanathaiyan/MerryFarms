"use server"

import { z } from "zod"
import { requireTenant } from "@/lib/tenant"
import { normaliseIndianMobile } from "@/domain/phone"
import { OrderError, placeOrder } from "@/server/orders"
import { featuresOf } from "@/lib/features"
import { areaConfigured, checkArea } from "@/domain/delivery-area"
import { areaOf } from "@/server/orders"

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(10).max(20),
  addressLine: z.string().trim().min(5).max(300),
  landmark: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  slotKey: z.string().regex(/^\d{4}-\d{2}-\d{2}\|[\w-]+$/),
  paymentMethod: z.enum(["upi_on_delivery", "cash_on_delivery"]),
  language: z.enum(["ta", "en"]),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1).max(30),
  note: z.string().trim().max(300).optional(),
})

export type PlaceWebOrderResult =
  | { ok: true; orderNumber: number; totalPaise: number; needsCall: boolean }
  | { ok: false; error: string }

/**
 * Web shop checkout. No customer login: the order is tied to the phone number given,
 * and the farm's confirmation call (for new customers) catches wrong or fake numbers.
 */
export async function placeWebOrder(raw: unknown): Promise<PlaceWebOrderResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const input = parsed.data

  const phone = normaliseIndianMobile(input.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }

  const tenant = await requireTenant()
  if (tenant.status === "suspended") return { ok: false, error: "shop_paused" }
  if (!featuresOf(tenant).webShop) return { ok: false, error: "shop_ordering_off" }

  try {
    const { order, decision } = await placeOrder(tenant, {
      channel: "web",
      customer: { phone, name: input.name, language: input.language },
      address: { line: input.addressLine, landmark: input.landmark, pincode: input.pincode, lat: input.lat, lng: input.lng },
      items: input.items,
      slotKey: input.slotKey,
      paymentMethod: input.paymentMethod,
      note: input.note,
    })
    return { ok: true, orderNumber: order.number, totalPaise: order.totalPaise, needsCall: decision.needsCall }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

const areaSchema = z.object({
  pincode: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

/**
 * "Do you deliver to me?" for the checkout. Answers inside / outside / unknown only,
 * so the farm's exact location never leaves the server.
 */
export async function checkMyArea(raw: unknown): Promise<{ result: "inside" | "outside" | "unknown" | "not_set" }> {
  const parsed = areaSchema.safeParse(raw)
  if (!parsed.success) return { result: "unknown" }
  const tenant = await requireTenant()
  const area = areaOf(tenant)
  if (!featuresOf(tenant).deliveryArea || !areaConfigured(area)) return { result: "not_set" }
  const { pincode, lat, lng } = parsed.data
  return { result: checkArea(area, { pincode, location: lat != null && lng != null ? { lat, lng } : null }).result }
}
