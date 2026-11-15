"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, ORDER_DESK, requireStaff } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { noteSupportWrite } from "@/server/support"
import { rupeesToPaise } from "@/domain/money"
import { isValidUpiId } from "@/domain/upi"
import { normaliseIndianMobile } from "@/domain/phone"
import { deliverOrder, recordPayment } from "@/server/billing"
import { cannotEnable, FEATURE_KEYS, parseChoices, resolveFeatures } from "@/domain/features"
import { audit, staffActor } from "@/server/audit"
import { parsePincodes } from "@/domain/delivery-area"
import { OrderError } from "@/server/orders"
import { notifyOrderStatus } from "@/server/notify"
import { featureSource } from "@/lib/features"
import { CUSTOMER_KINDS, STAFF_SOURCES } from "@/domain/customers"
import { addCustomerByStaff, logConsent } from "@/server/customers"

type Result = { ok: true; invoiceId?: string } | { ok: false; error: string }

const fail = (e: unknown): Result => {
  if (e instanceof OrderError) return { ok: false, error: e.code }
  throw e
}

const deliverSchema = z.object({ orderId: z.string().min(1), payment: z.enum(["cash", "upi", "credit"]) })

/** Delivery staff mark an order delivered and say how it was paid. */
export async function deliver(raw: unknown): Promise<Result> {
  const parsed = deliverSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant, staff } = await requireStaff(["owner", "order_desk", "delivery"])
  try {
    const { invoice } = await deliverOrder(tenant.id, parsed.data.orderId, parsed.data.payment, staff.id)
    await notifyOrderStatus(tenant.id, parsed.data.orderId)
    revalidatePath("/farm", "layout")
    return { ok: true, invoiceId: invoice?.id }
  } catch (e) {
    return fail(e)
  }
}

const paymentSchema = z.object({
  customerId: z.string().min(1),
  amountRupees: z.number().positive().max(10_000_000),
  method: z.enum(["cash_on_delivery", "upi_on_delivery"]),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
})

export async function addPaymentAction(raw: unknown): Promise<Result> {
  const parsed = paymentSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant, staff } = await requireStaff(["owner", "order_desk", "delivery"])
  try {
    await recordPayment(tenant.id, {
      customerId: parsed.data.customerId,
      method: parsed.data.method,
      amountPaise: rupeesToPaise(parsed.data.amountRupees),
      byStaffId: staff.id,
      reference: parsed.data.reference || undefined,
      note: parsed.data.note || undefined,
    })
  } catch (e) {
    return fail(e)
  }
  revalidatePath("/farm", "layout")
  return { ok: true }
}

const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  language: z.enum(["ta", "en"]),
  isTrusted: z.boolean(),
  creditLimitRupees: z.number().min(0).max(1_000_000),
  marketingOptIn: z.boolean(),
  smsOptIn: z.boolean(),
  /** How the customer told the farm about offers, when they changed. */
  consentHow: z.enum(["in_person", "phone"]),
  kind: z.enum(CUSTOMER_KINDS),
  notes: z.string().trim().max(500).optional(),
})

export async function updateCustomer(raw: unknown): Promise<Result> {
  const parsed = customerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  // Trust and credit decide whether orders skip the call or go on khata: order desk and owner only.
  const { db, tenant, staff } = await requireStaff(ORDER_DESK)
  const { id, creditLimitRupees, marketingOptIn, smsOptIn, consentHow, notes, ...rest } = parsed.data
  const current = await db.customer.findFirst({ where: { id } })
  if (!current) return { ok: false, error: "customer_not_found" }
  await logConsent(db, tenant.id, id, { whatsapp: current.marketingOptIn, sms: current.smsOptIn }, { whatsapp: marketingOptIn, sms: smsOptIn }, consentHow, staff.id)
  await db.customer.updateMany({
    where: { id },
    data: {
      ...rest,
      notes: notes || null,
      creditLimitPaise: rupeesToPaise(creditLimitRupees),
      marketingOptIn,
      smsOptIn,
      // Keep proof of when the customer agreed to offers (DPDP Act).
      optInAt: marketingOptIn && !current.marketingOptIn ? new Date() : marketingOptIn ? current.optInAt : null,
    },
  })
  revalidatePath("/farm", "layout")
  return { ok: true }
}

const settingsSchema = z.object({
  nameTa: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  phone: z.string().trim(),
  whatsappNumber: z.string().trim(),
  upiId: z.string().trim().max(100),
  gstin: z.string().trim().toUpperCase().max(15),
  fssaiNo: z.string().trim().max(14),
  deliveryFeeRupees: z.number().min(0).max(10_000),
  freeAboveRupees: z.number().min(0).max(1_000_000),
})

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export async function saveFarmSettings(raw: unknown): Promise<Result> {
  const parsed = settingsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const s = parsed.data
  const phone = normaliseIndianMobile(s.phone)
  const whatsapp = s.whatsappNumber ? normaliseIndianMobile(s.whatsappNumber) : phone
  if (!phone || !whatsapp) return { ok: false, error: "phone_invalid" }
  if (s.upiId && !isValidUpiId(s.upiId)) return { ok: false, error: "upi_invalid" }
  if (s.gstin && !GSTIN.test(s.gstin)) return { ok: false, error: "gstin_invalid" }
  if (s.fssaiNo && !/^\d{14}$/.test(s.fssaiNo)) return { ok: false, error: "fssai_invalid" }

  const { tenant } = await requireStaff(OWNER_ONLY)
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      nameTa: s.nameTa,
      nameEn: s.nameEn,
      phone,
      whatsappNumber: whatsapp,
      upiId: s.upiId || null,
      gstin: s.gstin || null,
      fssaiNo: s.fssaiNo || null,
      deliveryFeePaise: rupeesToPaise(s.deliveryFeeRupees),
      freeAbovePaise: rupeesToPaise(s.freeAboveRupees),
    },
  })
  await noteSupportWrite(tenant.id, "Tenant", "update", { id: tenant.id })
  revalidatePath("/", "layout")
  return { ok: true }
}

const featuresSchema = z.record(z.string(), z.boolean())

/** The owner switches farm features on or off. Locked features (plan, not built yet) stay off. */
export async function saveFeatures(raw: unknown): Promise<Result> {
  const parsed = featuresSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant, staff, support } = await requireStaff(OWNER_ONLY)
  const choices = parseChoices(tenant.features)
  const before = resolveFeatures(featureSource(tenant), choices)
  const source = featureSource(tenant)
  for (const key of FEATURE_KEYS) {
    const want = parsed.data[key]
    if (typeof want !== "boolean") continue
    const locked = cannotEnable(source, key)
    // Not in the plan or not built: can't be switched on. Fixed on by the plan: can't be switched off.
    if ((want && locked && locked !== "forced") || (!want && locked === "forced")) continue
    choices[key] = want
  }
  await prisma.tenant.update({ where: { id: tenant.id }, data: { features: choices } })
  await noteSupportWrite(tenant.id, "Tenant", "update", { id: tenant.id })
  const after = resolveFeatures(source, choices)
  await audit(
    staffActor(staff, support),
    FEATURE_KEYS.filter((k) => before[k] !== after[k]).map((k) => ({ tenantId: tenant.id, action: "feature.switched", subject: k, before: before[k], after: after[k] })),
  )
  revalidatePath("/", "layout")
  return { ok: true }
}

const areaSettingsSchema = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  radiusKm: z.number().min(0).max(100).nullable(),
  pincodes: z.string().max(2000),
})

/** The owner sets the farm's location, delivery radius and PIN codes served. */
export async function saveDeliveryArea(raw: unknown): Promise<Result> {
  const parsed = areaSettingsSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { lat, lng, radiusKm, pincodes } = parsed.data
  if ((lat === null) !== (lng === null)) return { ok: false, error: "location_invalid" }
  const pins = parsePincodes(pincodes)
  if (pins.invalid.length) return { ok: false, error: "pincode_invalid" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { farmLat: lat, farmLng: lng, deliveryRadiusKm: radiusKm && radiusKm > 0 ? radiusKm : null, servedPincodes: pins.valid },
  })
  await noteSupportWrite(tenant.id, "Tenant", "update", { id: tenant.id })
  revalidatePath("/", "layout")
  return { ok: true }
}

const newCustomerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(10).max(20),
  language: z.enum(["ta", "en"]),
  source: z.enum(STAFF_SOURCES),
  kind: z.enum(CUSTOMER_KINDS),
  whatsappOffers: z.boolean(),
  smsOffers: z.boolean(),
  consentHow: z.enum(["in_person", "phone"]),
  addressLine: z.string().trim().max(300),
  landmark: z.string().trim().max(120),
  pincode: z.union([z.literal(""), z.string().trim().regex(/^[1-9]d{5}$/)]),
})

/** Staff add a customer who came in person, by phone or at the market. A number already known opens that customer. */
export async function addCustomerAction(raw: unknown): Promise<{ ok: true; id: string; existed: boolean } | { ok: false; error: string }> {
  const parsed = newCustomerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  const { db, tenant, staff } = await requireStaff(ORDER_DESK)
  const { addressLine, landmark, pincode, ...f } = parsed.data
  try {
    const r = await addCustomerByStaff(db, tenant.id, staff.id, {
      ...f,
      phone,
      address: addressLine.length >= 5 ? { line: addressLine, landmark: landmark || undefined, pincode: pincode || undefined } : null,
    })
    revalidatePath("/farm/customers")
    return { ok: true, id: r.id, existed: r.status === "exists" }
  } catch (e) {
    return fail(e) as { ok: false; error: string }
  }
}
