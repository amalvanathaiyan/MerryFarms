"use server"

import { z } from "zod"
import { requireTenant } from "@/lib/tenant"
import { normaliseIndianMobile } from "@/domain/phone"
import { OrderError, placeOrder } from "@/server/orders"
import { featuresOf } from "@/lib/features"
import { areaConfigured, checkArea } from "@/domain/delivery-area"
import { areaOf } from "@/server/orders"
import { tenantDb } from "@/lib/tenant-db"
import { forgetCustomer, getSessionCustomer, rememberCustomer } from "@/lib/customer-session"
import { connectCustomer, issueToken } from "@/server/customers"
import { notifyStaff } from "@/server/notify"
import { otpOn } from "@/server/otp"
import { staffNewOrderNote } from "@/domain/notifications"
import { orderCode } from "@/domain/orders"

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
  | {
      ok: true
      orderNumber: number
      totalPaise: number
      needsCall: boolean
      /** "connected": this phone now remembers the customer. "known": the number belongs to an
       *  existing customer, so the farm will send their personal link instead. */
      account: "connected" | "known" | "off"
    }
  | { ok: false; error: string }

/**
 * Web shop checkout. No customer login: the order is tied to the phone number given,
 * and the farm's confirmation call (for new customers) catches wrong or fake numbers.
 */
export async function placeWebOrder(raw: unknown): Promise<PlaceWebOrderResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const input = parsed.data

  const typed = normaliseIndianMobile(input.phone)
  if (!typed) return { ok: false, error: "phone_invalid" }

  const tenant = await requireTenant()
  if (tenant.status === "suspended") return { ok: false, error: "shop_paused" }
  if (!featuresOf(tenant).webShop) return { ok: false, error: "shop_ordering_off" }

  const accounts = featuresOf(tenant).customerAccounts
  const session = accounts ? await getSessionCustomer() : null
  // With code sign-in, only a verified number can order, and always as itself.
  const verifiedOnly = otpOn(tenant)
  if (verifiedOnly && !session) return { ok: false, error: "sign_in_needed" }
  const phone = verifiedOnly && session ? session.phone : typed
  const known = accounts && !session ? await tenantDb(tenant.id).customer.findFirst({ where: { phone }, select: { id: true } }) : null

  try {
    const { order, decision, customer } = await placeOrder(tenant, {
      channel: "web",
      customer: { phone, name: input.name, language: input.language },
      address: { line: input.addressLine, landmark: input.landmark, pincode: input.pincode, lat: input.lat, lng: input.lng },
      items: input.items,
      slotKey: input.slotKey,
      paymentMethod: input.paymentMethod,
      note: input.note,
    })
    let account: "connected" | "known" | "off" = "off"
    if (accounts) {
      if (session && session.id === customer.id) account = "connected"
      else if (!session && !known) {
        // A brand-new customer: give this phone their key so next time is pre-filled.
        await rememberCustomer(await issueToken(tenant.id, customer.id))
        account = "connected"
      } else account = "known"
    }
    await notifyStaff(
      tenant.id,
      staffNewOrderNote({ code: orderCode(tenant.invoicePrefix, order.number), customerName: customer.name, totalPaise: order.totalPaise, needsCall: decision.needsCall })
    )
    return { ok: true, orderNumber: order.number, totalPaise: order.totalPaise, needsCall: decision.needsCall, account }
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

const connectSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(10).max(20),
  language: z.enum(["ta", "en"]),
})

/** A visitor (e.g. from the QR code) connects with name and number, before any order. */
export async function connectAction(raw: unknown): Promise<{ ok: true; status: "connected" | "known" } | { ok: false; error: string }> {
  const parsed = connectSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  const tenant = await requireTenant()
  if (!featuresOf(tenant).customerAccounts) return { ok: false, error: "accounts_off" }
  if (otpOn(tenant)) return { ok: false, error: "sign_in_needed" }
  const r = await connectCustomer(tenant, { ...parsed.data, phone })
  if (r.status === "connected") await rememberCustomer(r.token)
  return { ok: true, status: r.status }
}

/** "Not you?" on a shared phone: forget the customer on this phone. */
export async function forgetMeAction() {
  await forgetCustomer()
}
