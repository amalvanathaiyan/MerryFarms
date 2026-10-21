"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, ORDER_DESK, requireStaff } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { rupeesToPaise } from "@/domain/money"
import { isValidUpiId } from "@/domain/upi"
import { normaliseIndianMobile } from "@/domain/phone"
import { deliverOrder, recordPayment } from "@/server/billing"
import { cannotEnable, FEATURE_KEYS, parseChoices } from "@/domain/features"
import { OrderError } from "@/server/orders"

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
  notes: z.string().trim().max(500).optional(),
})

export async function updateCustomer(raw: unknown): Promise<Result> {
  const parsed = customerSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  // Trust and credit decide whether orders skip the call or go on khata: order desk and owner only.
  const { db } = await requireStaff(ORDER_DESK)
  const { id, creditLimitRupees, marketingOptIn, notes, ...rest } = parsed.data
  const current = await db.customer.findFirst({ where: { id } })
  if (!current) return { ok: false, error: "customer_not_found" }
  await db.customer.updateMany({
    where: { id },
    data: {
      ...rest,
      notes: notes || null,
      creditLimitPaise: rupeesToPaise(creditLimitRupees),
      marketingOptIn,
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
  revalidatePath("/", "layout")
  return { ok: true }
}

const featuresSchema = z.record(z.string(), z.boolean())

/** The owner switches farm features on or off. Locked features (plan, not built yet) stay off. */
export async function saveFeatures(raw: unknown): Promise<Result> {
  const parsed = featuresSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  const choices = parseChoices(tenant.features)
  for (const key of FEATURE_KEYS) {
    const want = parsed.data[key]
    if (typeof want !== "boolean") continue
    if (want && cannotEnable(tenant.plan, key)) continue
    choices[key] = want
  }
  await prisma.tenant.update({ where: { id: tenant.id }, data: { features: choices } })
  revalidatePath("/", "layout")
  return { ok: true }
}
