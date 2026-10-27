"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireTenant } from "@/lib/tenant"
import { normaliseIndianMobile } from "@/domain/phone"
import { cancelByCustomer, changeableOrder, OrderError, placeOrder } from "@/server/orders"
import { featuresOf } from "@/lib/features"
import { areaConfigured, checkArea, comparePincodes, type LatLng, type PinCheck } from "@/domain/delivery-area"
import { findPlaces, locationFromLink, pincodeCentre, placeAt, type PlaceMatch } from "@/server/geo"
import { getLocale } from "next-intl/server"
import { areaOf } from "@/server/orders"
import { tenantDb } from "@/lib/tenant-db"
import { forgetCustomer, getSessionCustomer, rememberCustomer } from "@/lib/customer-session"
import { connectCustomer, issueToken } from "@/server/customers"
import { alertFarmOnWhatsApp, notifyStaff } from "@/server/notify"
import { otpOn } from "@/server/otp"
import { staffNewOrderNote } from "@/domain/notifications"
import { CUSTOMER_CANCEL_REASONS, orderCode } from "@/domain/orders"

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(10).max(20),
  addressLine: z.string().trim().min(5).max(300),
  landmark: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  locationSource: z.enum(["gps", "map", "link"]).optional(),
  /** Delivering to someone else: who receives it, and their phone (the delivery person calls them). */
  receiverName: z.string().trim().min(1).max(80).optional(),
  receiverPhone: z.string().trim().min(10).max(20).optional(),
  slotKey: z.string().regex(/^\d{4}-\d{2}-\d{2}\|[\w-]+$/),
  paymentMethod: z.enum(["upi_on_delivery", "cash_on_delivery"]),
  language: z.enum(["ta", "en"]),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(50) })).min(1).max(30),
  note: z.string().trim().max(300).optional(),
  /** "Change my order": this new order replaces the customer's earlier one. */
  replaces: z.string().min(1).optional(),
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
  const receiverPhone = input.receiverPhone ? normaliseIndianMobile(input.receiverPhone) : null
  if (input.receiverPhone && !receiverPhone) return { ok: false, error: "receiver_phone_invalid" }
  if (!!input.receiverName !== !!input.receiverPhone) return { ok: false, error: "receiver_incomplete" }

  const tenant = await requireTenant()
  if (tenant.status === "suspended") return { ok: false, error: "shop_paused" }
  if (!featuresOf(tenant).webShop) return { ok: false, error: "shop_ordering_off" }

  const accounts = featuresOf(tenant).customerAccounts
  const session = accounts ? await getSessionCustomer() : null
  // With code sign-in, only a verified number can order, and always as itself.
  const verifiedOnly = otpOn(tenant)
  if (verifiedOnly && !session) return { ok: false, error: "sign_in_needed" }
  const phone = verifiedOnly && session ? session.phone : typed

  // Changing an order: it must be theirs and still changeable, checked before placing the new one.
  let replacing: Awaited<ReturnType<typeof changeableOrder>> | null = null
  if (input.replaces) {
    if (!session) return { ok: false, error: "sign_in_needed" }
    try {
      replacing = await changeableOrder(tenant.id, session.id, input.replaces)
    } catch (e) {
      if (e instanceof OrderError) return { ok: false, error: e.code }
      throw e
    }
  }
  const known = accounts && !session ? await tenantDb(tenant.id).customer.findFirst({ where: { phone }, select: { id: true } }) : null

  // The spot is named and its PIN compared here on the server; what the browser said isn't trusted.
  const spot = input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : null
  const place = spot ? await placeAt(spot, input.language) : null

  try {
    const { order, decision, customer } = await placeOrder(tenant, {
      channel: "web",
      customer: { phone, name: input.name, language: input.language },
      address: {
        line: input.addressLine,
        landmark: input.landmark,
        pincode: input.pincode,
        lat: input.lat,
        lng: input.lng,
        locationSource: spot ? (input.locationSource ?? "gps") : undefined,
        placeName: place?.label || undefined,
        receiverName: input.receiverName,
        receiverPhone: receiverPhone ?? undefined,
      },
      pinCheck: spot ? comparePincodes(input.pincode, place?.pincode) : undefined,
      items: input.items,
      slotKey: input.slotKey,
      paymentMethod: input.paymentMethod,
      note: input.note,
      replaces: replacing?.id,
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
    const code = orderCode(tenant.invoicePrefix, order.number)
    await notifyStaff(tenant.id, staffNewOrderNote({ code, customerName: customer.name, totalPaise: order.totalPaise, needsCall: decision.needsCall }))
    await alertFarmOnWhatsApp(tenant, { code, customerName: customer.name, totalPaise: order.totalPaise, needsCall: decision.needsCall, items: await itemsText(tenant.id, order.id) })
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

export interface AreaAnswer {
  result: "inside" | "outside" | "unknown" | "not_set"
  /** The place at the chosen spot, for the customer to confirm: "Velachery, Chennai 600042". */
  place?: string
  /** The PIN code at the spot, and how it compares with the one typed. */
  spotPincode?: string
  pinCheck?: PinCheck
}

/**
 * "Do you deliver to me?" for the checkout, and "is this the right spot?": names the place at the location
 * and compares its PIN with the one typed. Answers inside / outside / unknown only, so the farm's exact
 * location never leaves the server.
 */
export async function checkMyArea(raw: unknown): Promise<AreaAnswer> {
  const parsed = areaSchema.safeParse(raw)
  if (!parsed.success) return { result: "unknown" }
  const tenant = await requireTenant()
  const { pincode, lat, lng } = parsed.data
  const location = lat != null && lng != null ? { lat, lng } : null
  const area = areaOf(tenant)
  const result = !featuresOf(tenant).deliveryArea || !areaConfigured(area) ? "not_set" : checkArea(area, { pincode, location }).result
  if (!location) return { result }
  const place = await placeAt(location, (await getLocale()) === "ta" ? "ta" : "en")
  return { result, place: place?.label || undefined, spotPincode: place?.pincode ?? undefined, pinCheck: comparePincodes(pincode, place?.pincode) }
}

/** Where the checkout map opens: the PIN code's area, else roughly the farm's area (never its exact spot), else Tamil Nadu. */
export async function mapStart(raw: unknown): Promise<LatLng & { zoom: number }> {
  const pincode = z.string().trim().optional().safeParse(raw).data
  const centre = pincode ? await pincodeCentre(pincode) : null
  if (centre) return { ...centre, zoom: 15 }
  const tenant = await requireTenant()
  if (tenant.farmLat != null && tenant.farmLng != null) {
    const rough = (v: number) => Math.round(v * 20) / 20 // ~5 km grid
    return { lat: rough(tenant.farmLat), lng: rough(tenant.farmLng), zoom: 12 }
  }
  return { lat: 11.1, lng: 78.6, zoom: 7 }
}

/** Place search for the checkout map ("Velachery bus stand"), nearest the delivery area first. */
export async function searchPlaces(raw: unknown): Promise<PlaceMatch[]> {
  const parsed = z.object({ query: z.string().trim().min(3).max(120), near: z.object({ lat: z.number(), lng: z.number() }).optional() }).safeParse(raw)
  if (!parsed.success) return []
  await requireTenant()
  return findPlaces(parsed.data.query, parsed.data.near ?? null, (await getLocale()) === "ta" ? "ta" : "en")
}

/** A pasted maps link (WhatsApp location, Google Maps, OpenStreetMap, short share links) → its spot. */
export async function readLocationLink(raw: unknown): Promise<LatLng | null> {
  const link = z.string().trim().min(5).max(2000).safeParse(raw)
  if (!link.success) return null
  await requireTenant()
  return locationFromLink(link.data)
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

/** "2 × நாட்டுக் கோழி முட்டை (30 முட்டை), …" for the farm's WhatsApp alert. */
async function itemsText(tenantId: string, orderId: string) {
  const items = await tenantDb(tenantId).orderItem.findMany({ where: { orderId }, include: { product: true } })
  return items.map((i) => `${i.qty} × ${i.product.nameTa} (${i.product.packTa})`).join(", ")
}

/** The customer cancels their own order from My orders, before the cut-off. */
export async function cancelMyOrder(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.object({ orderId: z.string().min(1), reason: z.enum(CUSTOMER_CANCEL_REASONS) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const tenant = await requireTenant()
  const me = await getSessionCustomer()
  if (!me) return { ok: false, error: "sign_in_needed" }
  try {
    const order = await cancelByCustomer(tenant.id, me.id, parsed.data.orderId, parsed.data.reason)
    const code = orderCode(tenant.invoicePrefix, order.number)
    await notifyStaff(tenant.id, { title: `ரத்து · Cancelled ${code}`, body: `${me.name} · ${parsed.data.reason === "mistake" ? "தவறுதலாக / by mistake" : parsed.data.reason === "not_needed" ? "தேவையில்லை / not needed" : "வேறு காரணம் / other"}`, url: "/farm/orders?tab=done", tag: `new-${code}` })
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  revalidatePath("/my")
  revalidatePath("/farm", "layout")
  return { ok: true }
}
