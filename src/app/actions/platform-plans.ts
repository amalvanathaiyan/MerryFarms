"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requirePlatformAdmin, requireStaff } from "@/lib/auth"
import { MODULE_KEYS } from "@/domain/modules"
import { SUBSCRIPTION_STATES } from "@/domain/entitlements"
import { OrderError } from "@/server/orders"
import { noteSupportWrite } from "@/server/support"
import {
  createPlan,
  createStarterPlans,
  decideRequest,
  removeSubscription,
  requestAddOn,
  requestPlanChange,
  saveModuleSetting,
  setPlanRetired,
  setSubscription,
  updatePlan,
  withdrawRequest,
} from "@/server/subscriptions"

/** Plans, subscriptions, module settings and requests (docs/platform-plan.md §3.5). Admin actions check the caller first. */

type Result = { ok: true; id?: string; newVersion?: boolean } | { ok: false; error: string }

async function attempt(fn: () => Promise<Result>, paths: string[]): Promise<Result> {
  try {
    const r = await fn()
    for (const p of paths) revalidatePath(p, "layout")
    return r
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[plans]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

const paise = z.number().int().min(0).max(100_000_000)
const planSchema = z.object({
  nameTa: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  descriptionTa: z.string().trim().max(300).nullable(),
  descriptionEn: z.string().trim().max(300).nullable(),
  monthlyPaise: paise,
  yearlyPaise: paise.nullable(),
  trialDays: z.number().int().min(0).max(365),
  modules: z.array(z.enum(MODULE_KEYS)).max(MODULE_KEYS.length),
  features: z.record(z.string(), z.enum(["on", "off", "farm"])),
  limits: z.record(z.string(), z.number().int().min(0).max(1_000_000).nullable()),
  isPublic: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
})

// ── Platform admin ───────────────────────────────────────────────────────────

export async function savePlanAction(id: string | null, raw: unknown): Promise<Result> {
  const parsed = planSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  await requirePlatformAdmin()
  const input = { ...parsed.data, features: Object.fromEntries(Object.entries(parsed.data.features).filter(([, v]) => v !== "farm")) }
  return attempt(async () => {
    if (!id) return { ok: true, id: (await createPlan(input)).id }
    const r = await updatePlan(id, input)
    return { ok: true, id: r.id, newVersion: r.newVersion }
  }, ["/admin"])
}

export async function retirePlanAction(id: string, retired: boolean): Promise<Result> {
  await requirePlatformAdmin()
  return attempt(async () => {
    await setPlanRetired(id, retired)
    return { ok: true }
  }, ["/admin"])
}

export async function createStarterPlansAction(): Promise<Result> {
  await requirePlatformAdmin()
  return attempt(async () => {
    await createStarterPlans()
    return { ok: true }
  }, ["/admin"])
}

export async function setSubscriptionAction(tenantId: string, raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      planId: z.string().min(1),
      status: z.enum(SUBSCRIPTION_STATES),
      billingCycle: z.enum(["monthly", "yearly"]),
      trialEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      addOns: z.array(z.enum(MODULE_KEYS)),
      moduleOverrides: z.record(z.string(), z.boolean()),
      priceOverridePaise: paise.nullable(),
      notes: z.string().max(500).nullable(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  await requirePlatformAdmin()
  return attempt(async () => {
    await setSubscription(tenantId, parsed.data)
    return { ok: true }
  }, ["/admin", "/"])
}

export async function removeSubscriptionAction(tenantId: string): Promise<Result> {
  await requirePlatformAdmin()
  return attempt(async () => {
    await removeSubscription(tenantId)
    return { ok: true }
  }, ["/admin", "/"])
}

export async function saveModuleSettingAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ key: z.enum(MODULE_KEYS), enabled: z.boolean(), addOnMonthlyPaise: paise.nullable(), addOnYearlyPaise: paise.nullable(), addOnTrialDays: z.number().int().min(0).max(365), requestable: z.boolean() })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  await requirePlatformAdmin()
  const { key, ...s } = parsed.data
  return attempt(async () => {
    await saveModuleSetting(key, s)
    return { ok: true }
  }, ["/admin", "/"])
}

export async function decideRequestAction(id: string, approve: boolean, reply: string | null): Promise<Result> {
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await decideRequest(id, approve, reply ? reply.slice(0, 500) : null, admin.name)
    return { ok: true }
  }, ["/admin", "/"])
}

// ── Farm owner ───────────────────────────────────────────────────────────────

export async function requestAddOnAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ moduleKey: z.enum(MODULE_KEYS), note: z.string().trim().max(500).nullable() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  return attempt(async () => {
    const r = await requestAddOn(tenant.id, staff.id, parsed.data.moduleKey, parsed.data.note || null)
    await noteSupportWrite(tenant.id, "FarmRequest", "create", { id: r.id })
    return { ok: true, id: r.id }
  }, ["/farm"])
}

export async function requestPlanChangeAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ planId: z.string().min(1), note: z.string().trim().max(500).nullable() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  return attempt(async () => {
    const r = await requestPlanChange(tenant.id, staff.id, parsed.data.planId, parsed.data.note || null)
    await noteSupportWrite(tenant.id, "FarmRequest", "create", { id: r.id })
    return { ok: true, id: r.id }
  }, ["/farm"])
}

export async function withdrawRequestAction(id: string): Promise<Result> {
  const { tenant } = await requireStaff(OWNER_ONLY)
  return attempt(async () => {
    await withdrawRequest(tenant.id, id)
    return { ok: true }
  }, ["/farm"])
}
