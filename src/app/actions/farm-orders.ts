"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { editOrder, OrderError, placeOrder, recordCall, setOrderStatus } from "@/server/orders"
import { deliverOrder } from "@/server/billing"
import { normaliseIndianMobile } from "@/domain/phone"

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

// ── Farm-side ordering ────────────────────────────────────────────────────────

/** Customer lookup for the new-order form: by name, or by 3+ digits of the phone number. */
export async function searchCustomers(q: string) {
  const { db } = await requireStaff(ORDER_DESK)
  const query = q.trim().slice(0, 40)
  if (query.length < 2) return []
  const digits = query.replace(/\D/g, "")
  const rows = await db.customer.findMany({
    where: { OR: [{ name: { contains: query, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] },
    include: { addresses: { orderBy: { createdAt: "desc" }, take: 3 } },
    take: 8,
  })
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    language: c.language,
    addresses: c.addresses.map((a) => ({ id: a.id, line: a.line, landmark: a.landmark })),
  }))
}

const itemsSchema = z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(1).max(500) })).min(1).max(40)
const addressSchema = z.object({
  id: z.string().optional(),
  line: z.string().trim().max(300).optional(),
  landmark: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/).optional(),
})
const paymentSchema = z.enum(["upi_on_delivery", "cash_on_delivery", "credit"])

const createSchema = z.object({
  channel: z.enum(["phone", "whatsapp", "walk_in"]),
  customer: z.object({ phone: z.string().trim(), name: z.string().trim().min(1).max(80), language: z.enum(["ta", "en"]) }),
  address: addressSchema.nullable(),
  items: itemsSchema,
  slotKey: z.string().nullable(),
  paymentMethod: paymentSchema,
  note: z.string().trim().max(300).optional(),
  /** Walk-in only: how the customer paid when taking the goods. */
  handover: z.enum(["cash", "upi", "credit"]).optional(),
})

type CreateResult = { ok: true; orderId: string; invoiceId?: string } | { ok: false; error: string }

/** An order taken by farm staff: by phone, typed in from WhatsApp, or a walk-in sale. */
export async function createFarmOrder(raw: unknown): Promise<CreateResult> {
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const input = parsed.data
  const phone = normaliseIndianMobile(input.customer.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  if (input.channel === "walk_in" && !input.handover) return { ok: false, error: "invalid" }

  const { tenant, staff } = await requireStaff(ORDER_DESK)
  try {
    const { order } = await placeOrder(tenant, {
      channel: input.channel,
      customer: { ...input.customer, phone },
      address: input.channel === "walk_in" ? null : input.address,
      items: input.items,
      slotKey: input.channel === "walk_in" ? null : input.slotKey,
      paymentMethod: input.channel === "walk_in" ? (input.handover === "credit" ? "credit" : input.handover === "upi" ? "upi_on_delivery" : "cash_on_delivery") : input.paymentMethod,
      note: input.note,
      byStaffId: staff.id,
      staffOverride: true,
    })
    let invoiceId: string | undefined
    if (input.channel === "walk_in" && input.handover) {
      const { invoice } = await deliverOrder(tenant.id, order.id, input.handover, staff.id)
      invoiceId = invoice?.id
    }
    revalidatePath("/farm", "layout")
    return { ok: true, orderId: order.id, invoiceId }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

const editSchema = z.object({
  orderId: z.string().min(1),
  items: itemsSchema,
  slotKey: z.string().min(1),
  address: addressSchema,
  paymentMethod: paymentSchema,
  note: z.string().trim().max(300).optional(),
  fromCall: z.boolean().optional(),
})

export async function updateFarmOrder(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = editSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { orderId, ...input } = parsed.data
  const { tenant, staff } = await requireStaff(ORDER_DESK)
  try {
    await editOrder(tenant, orderId, input, staff.id)
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
  revalidatePath("/farm", "layout")
  return { ok: true }
}
