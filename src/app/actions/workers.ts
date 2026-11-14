"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { rupeesToPaise } from "@/domain/money"
import { normaliseIndianMobile } from "@/domain/phone"
import { OrderError } from "@/server/orders"
import { markDays, payWorker, removePayment, saveWorker, setWorkerLeft } from "@/server/workers"

/** My farm · Workers: the owner and a manager keep workers, mark their days and pay them. */

type Result = { ok: true } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

async function attempt(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn()
    revalidatePath("/farm", "layout")
    return { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[workers]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

export async function saveWorkerAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: z.string().uuid().nullable(),
      name: z.string().trim().min(1).max(60),
      phone: z.string().trim().max(20).nullable(),
      role: z.string().trim().max(40).nullable(),
      payType: z.enum(["daily", "monthly"]),
      rateRupees: z.number().positive().max(1_000_000),
      joinedOn: ymd.nullable(),
      notes: z.string().trim().max(300).nullable(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = parsed.data.phone ? normaliseIndianMobile(parsed.data.phone) : null
  if (parsed.data.phone && !phone) return { ok: false, error: "phone_invalid" }
  const { db, tenant } = await requireStaff(["owner", "manager"])
  const { id, rateRupees, ...input } = parsed.data
  return attempt(() => saveWorker(db, tenant.id, id, { ...input, phone, ratePaise: rupeesToPaise(rateRupees) }))
}

export async function setWorkerLeftAction(id: string, leftOn: string | null): Promise<Result> {
  if (leftOn !== null && !ymd.safeParse(leftOn).success) return { ok: false, error: "invalid_form" }
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => setWorkerLeft(db, id, leftOn))
}

export async function markDaysAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ date: ymd, entries: z.array(z.object({ workerId: z.string().uuid(), state: z.enum(["present", "half", "absent"]).nullable(), placeId: z.string().uuid().nullable() })).min(1).max(300) })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  return attempt(() => markDays(db, tenant.id, parsed.data.date, parsed.data.entries, staff.id))
}

export async function payWorkerAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ workerId: z.string().uuid(), date: ymd, kind: z.enum(["wage", "advance"]), amountRupees: z.number().positive().max(10_000_000), note: z.string().trim().max(80).nullable() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  const { amountRupees, ...p } = parsed.data
  return attempt(() => payWorker(db, tenant.id, { ...p, amountPaise: rupeesToPaise(amountRupees), byStaffId: staff.id }))
}

export async function removePaymentAction(id: string): Promise<Result> {
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => removePayment(db, id))
}
