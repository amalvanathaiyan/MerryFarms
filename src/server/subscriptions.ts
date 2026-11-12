import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { computeEntitlement, cleanFeatureRules, cleanLimits, parseEntitlement, SUBSCRIPTION_STATES, type SubscriptionState } from "@/domain/entitlements"
import { FEATURE_KEYS, FEATURES, type Plan } from "@/domain/features"
import { isModuleKey, MODULE_KEYS, MODULES, type ModuleKey } from "@/domain/modules"
import { OrderError } from "./orders"
import { emitEvent } from "./events"

/**
 * Plans, farm subscriptions, the platform's module settings and farms' requests (docs/platform-plan.md §3.5).
 * Whatever changes what a farm may use ends in refreshEntitlements(), which saves the result on the farm.
 */

// ── Entitlements ─────────────────────────────────────────────────────────────

/** Modules the platform has switched off for every farm. */
async function platformOffModules(): Promise<string[]> {
  return (await prisma.moduleSetting.findMany({ where: { enabled: false }, select: { moduleKey: true } })).map((m) => m.moduleKey)
}

/** Works out and saves what the farm may use. No subscription = back to its old plan level (entitlements null). */
export async function refreshEntitlements(tenantId: string, off?: string[]) {
  const sub = await prisma.farmSubscription.findUnique({ where: { tenantId }, include: { plan: true } })
  const entitlements = sub
    ? (computeEntitlement(sub.plan, { status: sub.status as SubscriptionState, addOns: sub.addOns, moduleOverrides: sub.moduleOverrides }, off ?? (await platformOffModules())) as unknown as Prisma.InputJsonValue)
    : Prisma.DbNull
  await prisma.tenant.update({ where: { id: tenantId }, data: { entitlements } })
}

export async function refreshAllEntitlements() {
  const off = await platformOffModules()
  for (const s of await prisma.farmSubscription.findMany({ select: { tenantId: true } })) await refreshEntitlements(s.tenantId, off)
}

// ── Plans ────────────────────────────────────────────────────────────────────

export interface PlanInput {
  nameTa: string
  nameEn: string
  descriptionTa: string | null
  descriptionEn: string | null
  monthlyPaise: number
  yearlyPaise: number | null
  trialDays: number
  modules: string[]
  features: Record<string, string>
  limits: Record<string, number | null>
  isPublic: boolean
  sortOrder: number
}

function clean(input: PlanInput) {
  const modules = [...new Set(input.modules.filter((m): m is ModuleKey => isModuleKey(m) && !MODULES[m].alwaysOn))]
  // A feature rule only means something for a feature of one of the plan's modules (or Farm Core)
  const rules = cleanFeatureRules(input.features)
  const features = Object.fromEntries(Object.entries(rules).filter(([k]) => MODULES[FEATURES[k as keyof typeof FEATURES].module].alwaysOn || modules.includes(FEATURES[k as keyof typeof FEATURES].module)))
  const limits = cleanLimits(Object.fromEntries(Object.entries(input.limits).filter(([, v]) => v !== null)))
  return {
    nameTa: input.nameTa.trim(),
    nameEn: input.nameEn.trim(),
    descriptionTa: input.descriptionTa?.trim() || null,
    descriptionEn: input.descriptionEn?.trim() || null,
    monthlyPaise: Math.max(0, Math.round(input.monthlyPaise)),
    yearlyPaise: input.yearlyPaise === null ? null : Math.max(0, Math.round(input.yearlyPaise)),
    trialDays: Math.max(0, Math.min(365, Math.round(input.trialDays))),
    modules,
    features: features as Prisma.InputJsonValue,
    limits: limits as Prisma.InputJsonValue,
    isPublic: input.isPublic,
    sortOrder: input.sortOrder,
  }
}

const familyOf = (nameEn: string) =>
  nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "plan"

export async function createPlan(input: PlanInput) {
  const data = clean(input)
  let family = familyOf(data.nameEn)
  for (let n = 2; await prisma.platformPlan.findFirst({ where: { family } }); n++) family = `${familyOf(data.nameEn)}-${n}`
  return prisma.platformPlan.create({ data: { ...data, family } })
}

/**
 * Saves changes to a plan. If farms are on it and what they get or pay changes, a new version is made instead and the
 * old one retired: those farms keep the old version until admin moves them. Names, description, order and
 * visibility change in place.
 */
export async function updatePlan(id: string, input: PlanInput): Promise<{ id: string; newVersion: boolean }> {
  const old = await prisma.platformPlan.findUnique({ where: { id }, include: { _count: { select: { subscriptions: true } } } })
  if (!old) throw new OrderError("not_found")
  const data = clean(input)
  const material =
    old.monthlyPaise !== data.monthlyPaise ||
    old.yearlyPaise !== data.yearlyPaise ||
    old.trialDays !== data.trialDays ||
    JSON.stringify([...old.modules].sort()) !== JSON.stringify([...data.modules].sort()) ||
    JSON.stringify(cleanFeatureRules(old.features)) !== JSON.stringify(data.features) ||
    JSON.stringify(cleanLimits(old.limits)) !== JSON.stringify(data.limits)
  if (!material || old._count.subscriptions === 0) {
    await prisma.platformPlan.update({ where: { id }, data })
    if (material) for (const s of await prisma.farmSubscription.findMany({ where: { planId: id }, select: { tenantId: true } })) await refreshEntitlements(s.tenantId)
    return { id, newVersion: false }
  }
  const latest = await prisma.platformPlan.findFirst({ where: { family: old.family }, orderBy: { version: "desc" }, select: { version: true } })
  const created = await prisma.$transaction(async (tx) => {
    await tx.platformPlan.update({ where: { id }, data: { retired: true } })
    return tx.platformPlan.create({ data: { ...data, family: old.family, version: (latest?.version ?? old.version) + 1 } })
  })
  return { id: created.id, newVersion: true }
}

export async function setPlanRetired(id: string, retired: boolean) {
  await prisma.platformPlan.update({ where: { id }, data: { retired } })
}

/**
 * The four starting plans, made from the old fixed levels so nothing changes for a farm moved onto them: each holds
 * the modules and features that level allowed. Admin edits them freely afterwards.
 */
export async function createStarterPlans() {
  if (await prisma.platformPlan.count()) return
  const levels: { level: Plan; nameTa: string; nameEn: string; rank: number }[] = [
    { level: "free", nameTa: "இலவசம்", nameEn: "Free", rank: 0 },
    { level: "starter", nameTa: "தொடக்கம்", nameEn: "Starter", rank: 1 },
    { level: "growth", nameTa: "வளர்ச்சி", nameEn: "Growth", rank: 2 },
    { level: "pro", nameTa: "முழுமை", nameEn: "Pro", rank: 3 },
  ]
  const RANK: Record<Plan, number> = { free: 0, starter: 1, growth: 2, pro: 3 }
  for (const l of levels) {
    const off = FEATURE_KEYS.filter((k) => RANK[FEATURES[k].minPlan] > l.rank)
    const modules = MODULE_KEYS.filter((m) => !MODULES[m].alwaysOn && MODULES[m].available && FEATURE_KEYS.some((k) => FEATURES[k].module === m && !off.includes(k)))
    await createPlan({
      nameTa: l.nameTa,
      nameEn: l.nameEn,
      descriptionTa: null,
      descriptionEn: null,
      monthlyPaise: 0,
      yearlyPaise: null,
      trialDays: 30,
      modules,
      features: Object.fromEntries(off.map((k) => [k, "off"])),
      limits: {},
      isPublic: true,
      sortOrder: l.rank,
    })
  }
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export interface SubscriptionInput {
  planId: string
  status: string
  billingCycle: "monthly" | "yearly"
  trialEndsOn: string | null
  addOns: string[]
  moduleOverrides: Record<string, boolean>
  priceOverridePaise: number | null
  notes: string | null
}

export async function setSubscription(tenantId: string, input: SubscriptionInput) {
  if (!(SUBSCRIPTION_STATES as readonly string[]).includes(input.status)) throw new OrderError("invalid_form")
  const plan = await prisma.platformPlan.findUnique({ where: { id: input.planId }, select: { id: true } })
  if (!plan || !(await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }))) throw new OrderError("not_found")
  const data = {
    planId: plan.id,
    status: input.status,
    billingCycle: input.billingCycle,
    trialEndsAt: input.trialEndsOn ? new Date(`${input.trialEndsOn}T23:59:59+05:30`) : null,
    addOns: [...new Set(input.addOns.filter(isModuleKey))],
    moduleOverrides: Object.fromEntries(Object.entries(input.moduleOverrides).filter(([k, v]) => isModuleKey(k) && typeof v === "boolean")),
    priceOverridePaise: input.priceOverridePaise,
    notes: input.notes?.trim() || null,
  }
  await prisma.farmSubscription.upsert({ where: { tenantId }, update: data, create: { tenantId, ...data } })
  await refreshEntitlements(tenantId)
  await emitEvent("subscription.changed", tenantId, { planId: data.planId, status: data.status, addOns: data.addOns })
}

/** Back to the farm's old plan level (no admin-made plan). */
export async function removeSubscription(tenantId: string) {
  await prisma.farmSubscription.deleteMany({ where: { tenantId } })
  await refreshEntitlements(tenantId)
}

// ── Module settings ──────────────────────────────────────────────────────────

export async function moduleSettings() {
  const rows = await prisma.moduleSetting.findMany()
  return MODULE_KEYS.map((key) => {
    const r = rows.find((x) => x.moduleKey === key)
    return { key, enabled: r?.enabled ?? true, addOnMonthlyPaise: r?.addOnMonthlyPaise ?? null, addOnYearlyPaise: r?.addOnYearlyPaise ?? null, addOnTrialDays: r?.addOnTrialDays ?? 14, requestable: r?.requestable ?? true }
  })
}

export async function saveModuleSetting(key: ModuleKey, s: { enabled: boolean; addOnMonthlyPaise: number | null; addOnYearlyPaise: number | null; addOnTrialDays: number; requestable: boolean }) {
  const before = await prisma.moduleSetting.findUnique({ where: { moduleKey: key } })
  const enabled = MODULES[key].alwaysOn ? true : s.enabled
  const data = { ...s, enabled }
  await prisma.moduleSetting.upsert({ where: { moduleKey: key }, update: data, create: { moduleKey: key, ...data } })
  if ((before?.enabled ?? true) !== enabled) await refreshAllEntitlements()
}

// ── Farm requests ────────────────────────────────────────────────────────────

export async function requestAddOn(tenantId: string, byStaffId: string | null, moduleKey: ModuleKey, note: string | null) {
  const setting = (await moduleSettings()).find((m) => m.key === moduleKey)!
  if (!MODULES[moduleKey].available || MODULES[moduleKey].alwaysOn || !setting.enabled || !setting.requestable) throw new OrderError("invalid_form")
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { entitlements: true } })
  if (parseEntitlement(t?.entitlements)?.modules.includes(moduleKey)) throw new OrderError("already_have")
  if (await prisma.farmRequest.findFirst({ where: { tenantId, kind: "add_on", moduleKey, status: "pending" } })) throw new OrderError("request_pending")
  const r = await prisma.farmRequest.create({ data: { tenantId, kind: "add_on", moduleKey, note, byStaffId } })
  await emitEvent("request.created", tenantId, { requestId: r.id, kind: "add_on", moduleKey })
  return r
}

export async function requestPlanChange(tenantId: string, byStaffId: string | null, planId: string, note: string | null) {
  const plan = await prisma.platformPlan.findFirst({ where: { id: planId, isPublic: true, retired: false } })
  if (!plan) throw new OrderError("not_found")
  if (await prisma.farmRequest.findFirst({ where: { tenantId, kind: "plan_change", status: "pending" } })) throw new OrderError("request_pending")
  const r = await prisma.farmRequest.create({ data: { tenantId, kind: "plan_change", planId, note, byStaffId } })
  await emitEvent("request.created", tenantId, { requestId: r.id, kind: "plan_change", planId })
  return r
}

export async function withdrawRequest(tenantId: string, id: string) {
  await prisma.farmRequest.updateMany({ where: { id, tenantId, status: "pending" }, data: { status: "withdrawn" } })
}

/** Admin's answer. Approving an add-on adds the module (with its trial if the farm hasn't one); approving a plan change moves the farm. */
export async function decideRequest(id: string, approve: boolean, reply: string | null, decidedBy: string) {
  const req = await prisma.farmRequest.findUnique({ where: { id } })
  if (!req || req.status !== "pending") throw new OrderError("not_found")
  if (approve) {
    const sub = await prisma.farmSubscription.findUnique({ where: { tenantId: req.tenantId } })
    if (req.kind === "add_on" && req.moduleKey && isModuleKey(req.moduleKey)) {
      if (!sub) throw new OrderError("needs_plan")
      await prisma.farmSubscription.update({ where: { tenantId: req.tenantId }, data: { addOns: [...new Set([...sub.addOns, req.moduleKey])] } })
    } else if (req.kind === "plan_change" && req.planId) {
      const plan = await prisma.platformPlan.findUnique({ where: { id: req.planId } })
      if (!plan) throw new OrderError("not_found")
      const trialEndsAt = sub ? sub.trialEndsAt : new Date(Date.now() + plan.trialDays * 86_400_000)
      await prisma.farmSubscription.upsert({
        where: { tenantId: req.tenantId },
        update: { planId: plan.id },
        create: { tenantId: req.tenantId, planId: plan.id, status: plan.trialDays > 0 ? "trial" : "active", trialEndsAt: plan.trialDays > 0 ? trialEndsAt : null },
      })
    }
    await refreshEntitlements(req.tenantId)
  }
  await prisma.farmRequest.update({ where: { id }, data: { status: approve ? "approved" : "declined", reply: reply?.trim() || null, decidedBy, decidedAt: new Date() } })
  await emitEvent("request.decided", req.tenantId, { requestId: id, approved: approve, by: decidedBy })
}
