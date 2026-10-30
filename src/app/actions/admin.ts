"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin } from "@/lib/auth"
import { normaliseIndianMobile } from "@/domain/phone"
import { OrderError } from "@/server/orders"
import { addOwner, createFarm, resetPassword, updateFarm } from "@/server/platform"

/** Platform admin actions (FarmForYou, all farms). Every one checks the caller is a platform admin first. */

type Result = { ok: true; id?: string; password?: string | null } | { ok: false; error: string }

const PLANS = ["free", "starter", "growth", "pro"] as const

async function attempt(fn: () => Promise<Result>): Promise<Result> {
  try {
    const r = await fn()
    revalidatePath("/admin", "layout")
    return r
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[admin]", (e as Error).message)
    return { ok: false, error: "staff_login_failed" }
  }
}

const owner = z.object({ name: z.string().trim().min(1).max(60), email: z.string().trim().email().max(120), phone: z.string().trim().max(20).optional() })

export async function createFarmAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      nameTa: z.string().trim().min(1).max(80),
      nameEn: z.string().trim().min(1).max(80),
      slug: z.string().trim().toLowerCase().max(30),
      phone: z.string().trim().min(10).max(20),
      defaultLanguage: z.enum(["ta", "en"]),
      invoicePrefix: z.string().trim().toUpperCase().max(5),
      plan: z.enum(PLANS),
      trialDays: z.number().int().min(0).max(365),
      owner,
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  const ownerPhone = parsed.data.owner.phone ? normaliseIndianMobile(parsed.data.owner.phone) : undefined
  if (!phone || ownerPhone === null) return { ok: false, error: "phone_invalid" }
  await requirePlatformAdmin()
  return attempt(async () => {
    const r = await createFarm({ ...parsed.data, phone, owner: { ...parsed.data.owner, phone: ownerPhone } })
    return { ok: true, id: r.tenant.id, password: r.password }
  })
}

export async function updateFarmAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: z.string().min(1),
      nameTa: z.string().trim().min(1).max(80),
      nameEn: z.string().trim().min(1).max(80),
      phone: z.string().trim().min(10).max(20),
      invoicePrefix: z.string().trim().toUpperCase().max(5),
      defaultLanguage: z.enum(["ta", "en"]),
      plan: z.enum(PLANS),
      status: z.enum(["trial", "active", "suspended"]),
      trialEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  await requirePlatformAdmin()
  const { id, ...changes } = parsed.data
  return attempt(async () => {
    await updateFarm(id, { ...changes, phone })
    return { ok: true }
  })
}

export async function addOwnerAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ tenantId: z.string().min(1), owner }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const ownerPhone = parsed.data.owner.phone ? normaliseIndianMobile(parsed.data.owner.phone) : undefined
  if (ownerPhone === null) return { ok: false, error: "phone_invalid" }
  await requirePlatformAdmin()
  return attempt(async () => {
    const r = await addOwner(parsed.data.tenantId, { ...parsed.data.owner, phone: ownerPhone })
    return { ok: true, password: r.password }
  })
}

export async function resetPasswordAction(tenantId: string, staffId: string): Promise<Result> {
  await requirePlatformAdmin()
  return attempt(async () => ({ ok: true, password: await resetPassword(tenantId, staffId) }))
}
