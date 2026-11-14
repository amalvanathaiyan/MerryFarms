"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { rupeesToPaise } from "@/domain/money"
import { INPUT_KINDS, INPUT_UNITS } from "@/domain/inputs"
import { OrderError } from "@/server/orders"
import { buyInput, countInput, removeUse, saveInput, setInputRetired, takeOutInput } from "@/server/inputs"

/** My farm · Store: the owner and a manager keep the items, buy, use and count them. */

type Result = { ok: true } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const qty = z.number().positive().max(10_000_000)

async function attempt(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn()
    revalidatePath("/farm", "layout")
    return { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[inputs]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

export async function saveInputAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: z.string().uuid().nullable(),
      name: z.string().trim().min(1).max(60),
      kind: z.enum(INPUT_KINDS),
      unit: z.enum(INPUT_UNITS),
      lowAt: z.number().min(0).max(10_000_000).nullable(),
      batchFeed: z.boolean(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant } = await requireStaff(["owner", "manager"])
  const { id, ...f } = parsed.data
  // The hens' feed only means something with poultry care on
  return attempt(() => saveInput(db, tenant.id, id, { ...f, batchFeed: f.batchFeed && featuresOf(tenant).poultryCare }))
}

export async function setInputRetiredAction(id: string, retired: boolean): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid_form" }
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => setInputRetired(db, id, retired))
}

export async function buyInputAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ inputId: z.string().uuid(), date: ymd, quantity: qty, amountRupees: z.number().positive().max(10_000_000), note: z.string().trim().max(80).nullable() })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  const { amountRupees, ...p } = parsed.data
  return attempt(() => buyInput(db, tenant.id, { ...p, amountPaise: rupeesToPaise(amountRupees), byStaffId: staff.id }))
}

export async function takeOutInputAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ inputId: z.string().uuid(), date: ymd, quantity: qty, placeId: z.string().uuid().nullable(), note: z.string().trim().max(80).nullable() })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  return attempt(() => takeOutInput(db, tenant.id, { ...parsed.data, byStaffId: staff.id }))
}

export async function countInputAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ inputId: z.string().uuid(), counted: z.number().min(0).max(10_000_000) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  return attempt(() => countInput(db, tenant.id, { ...parsed.data, byStaffId: staff.id }))
}

export async function removeUseAction(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid_form" }
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => removeUse(db, id))
}
