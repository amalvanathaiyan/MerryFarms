"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { changePlan, createPlan, updatePlan } from "@/server/plans"
import { OrderError } from "@/server/orders"

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const planSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1),
  addressId: z.string().nullable(),
  slotId: z.string().min(1),
  items: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().min(0).max(100) })).min(1).max(20),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  paymentMethod: z.enum(["upi_on_delivery", "cash_on_delivery", "credit"]),
  discountPct: z.number().int().min(0).max(50),
  startDate: ymd,
  note: z.string().trim().max(300).optional(),
})

type Result = { ok: true; id?: string } | { ok: false; error: string }

const fail = (e: unknown): Result => {
  if (e instanceof OrderError) return { ok: false, error: e.code }
  throw e
}

export async function savePlan(raw: unknown): Promise<Result> {
  const parsed = planSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { id, ...input } = parsed.data
  const { tenant } = await requireStaff(ORDER_DESK)
  try {
    if (id) await updatePlan(tenant, id, input)
    else return done({ ok: true, id: (await createPlan(tenant, input)).id })
  } catch (e) {
    return fail(e)
  }
  return done({ ok: true, id })
}

const changeSchema = z.object({
  planId: z.string().min(1),
  change: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("pause"), until: ymd.nullable() }),
    z.object({ kind: z.literal("resume") }),
    z.object({ kind: z.literal("skip"), date: ymd }),
    z.object({ kind: z.literal("unskip"), date: ymd }),
    z.object({ kind: z.literal("cancel") }),
  ]),
})

export async function changePlanAction(raw: unknown): Promise<Result> {
  const parsed = changeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { tenant } = await requireStaff(ORDER_DESK)
  try {
    await changePlan(tenant.id, parsed.data.planId, parsed.data.change)
  } catch (e) {
    return fail(e)
  }
  return done({ ok: true })
}

function done(r: Result): Result {
  revalidatePath("/farm", "layout")
  return r
}
