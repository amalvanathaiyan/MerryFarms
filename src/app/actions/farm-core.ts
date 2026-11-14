"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { rupeesToPaise } from "@/domain/money"
import { OrderError } from "@/server/orders"
import { logAssetWork, saveAsset, savePlace, setAssetRetired, setPlaceRetired } from "@/server/farm-core"

/** My farm (Farm Core): the owner and a manager keep the farm's places and assets. */

type Result = { ok: true } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const text = (max: number) => z.string().trim().max(max).nullable()

async function attempt(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn()
    revalidatePath("/farm", "layout")
    return { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[farm-core]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

export async function savePlaceAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: z.string().uuid().nullable(),
      kind: z.string().max(20),
      name: z.string().trim().min(1).max(60),
      parentId: z.string().uuid().nullable(),
      area: z.number().positive().max(1_000_000).nullable(),
      areaUnit: z.string().max(10),
      surveyNo: text(40),
      soil: z.string().max(20).nullable(),
      depthFt: z.number().positive().max(5000).nullable(),
      notes: text(300),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant } = await requireStaff(["owner", "manager"])
  const { id, ...input } = parsed.data
  return attempt(() => savePlace(db, tenant.id, id, input))
}

export async function retirePlaceAction(id: string, retired: boolean): Promise<Result> {
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => setPlaceRetired(db, id, retired))
}

export async function saveAssetAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: z.string().uuid().nullable(),
      kind: z.string().max(20),
      name: z.string().trim().min(1).max(60),
      placeId: z.string().uuid().nullable(),
      boughtOn: ymd.nullable(),
      costRupees: z.number().positive().max(100_000_000).nullable(),
      serviceEveryDays: z.number().int().min(1).max(3650).nullable(),
      lastServiceOn: ymd.nullable(),
      notes: text(300),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant } = await requireStaff(["owner", "manager"])
  const { id, costRupees, ...input } = parsed.data
  return attempt(() => saveAsset(db, tenant.id, id, { ...input, costPaise: costRupees ? rupeesToPaise(costRupees) : null }))
}

export async function retireAssetAction(id: string, retired: boolean): Promise<Result> {
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => setAssetRetired(db, id, retired))
}

export async function logAssetWorkAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ id: z.string().uuid(), date: ymd, service: z.boolean(), amountRupees: z.number().positive().max(10_000_000).nullable(), note: text(120) })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  const d = parsed.data
  return attempt(() => logAssetWork(db, tenant.id, d.id, { date: d.date, service: d.service, amountPaise: d.amountRupees ? rupeesToPaise(d.amountRupees) : null, note: d.note, byStaffId: staff.id }))
}
