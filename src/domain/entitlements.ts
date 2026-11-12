/**
 * What a farm may use, worked out from its admin-made plan, its add-ons and admin's overrides (docs/platform-plan.md
 * §3.5). The result is saved on the farm (tenants.entitlements) whenever any of these change, so every feature check
 * reads one small value instead of joining plans. Pure, so it is tested.
 */
import { FEATURE_KEYS, type FeatureKey } from "./features"
import { isModuleKey, LIMIT_KEYS, MODULES, type Limits, type ModuleKey } from "./modules"

export const SUBSCRIPTION_STATES = ["trial", "active", "past_due", "paused", "ended"] as const
export type SubscriptionState = (typeof SUBSCRIPTION_STATES)[number]

/** A feature a plan fixes: "on" (always on, the farm can't switch it off) or "off" (not in the plan). Missing = the farm's choice. */
export type FeatureRules = Partial<Record<FeatureKey, "on" | "off">>

export interface Entitlement {
  planId: string | null
  modules: ModuleKey[]
  features: FeatureRules
  limits: Limits
  status: SubscriptionState
}

export interface PlanInput {
  id: string
  modules: string[]
  features: unknown
  limits: unknown
}
export interface SubscriptionInput {
  status: SubscriptionState
  addOns: string[]
  /** Admin's per-farm switches: true adds a module, false takes it away. */
  moduleOverrides: unknown
}

export function cleanFeatureRules(json: unknown): FeatureRules {
  const out: FeatureRules = {}
  if (!json || typeof json !== "object" || Array.isArray(json)) return out
  for (const k of FEATURE_KEYS) {
    const v = (json as Record<string, unknown>)[k]
    if (v === "on" || v === "off") out[k] = v
  }
  return out
}

export function cleanLimits(json: unknown): Limits {
  const out: Limits = {}
  if (!json || typeof json !== "object" || Array.isArray(json)) return out
  for (const k of LIMIT_KEYS) {
    const v = (json as Record<string, unknown>)[k]
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) out[k] = v
  }
  return out
}

function overrides(json: unknown): Partial<Record<ModuleKey, boolean>> {
  const out: Partial<Record<ModuleKey, boolean>> = {}
  if (!json || typeof json !== "object" || Array.isArray(json)) return out
  for (const [k, v] of Object.entries(json)) if (isModuleKey(k) && typeof v === "boolean") out[k] = v
  return out
}

/**
 * The farm's modules: Farm Core, the plan's modules and add-ons, then admin's overrides; never a module that isn't
 * built or that the platform switched off, nor one whose required module is missing. A paused or ended
 * subscription keeps only Farm Core (the farm's data stays; its screens come back when the plan resumes).
 */
export function computeEntitlement(plan: PlanInput, sub: SubscriptionInput, platformOff: readonly string[] = []): Entitlement {
  const set = new Set<ModuleKey>(["core"])
  if (sub.status !== "paused" && sub.status !== "ended") {
    for (const m of [...plan.modules, ...sub.addOns]) if (isModuleKey(m)) set.add(m)
    for (const [m, on] of Object.entries(overrides(sub.moduleOverrides)) as [ModuleKey, boolean][]) {
      if (on) set.add(m)
      else if (!MODULES[m].alwaysOn) set.delete(m)
    }
  }
  for (const m of [...set]) if (!MODULES[m].alwaysOn && (!MODULES[m].available || platformOff.includes(m))) set.delete(m)
  // Drop modules whose requirements are missing (repeat for chains)
  let changed = true
  while (changed) {
    changed = false
    for (const m of [...set]) {
      if (MODULES[m].requires.some((r) => !set.has(r))) {
        set.delete(m)
        changed = true
      }
    }
  }
  return {
    planId: plan.id,
    modules: [...set],
    features: cleanFeatureRules(plan.features),
    limits: cleanLimits(plan.limits),
    status: sub.status,
  }
}

/** The saved entitlement, read defensively; null when the farm isn't on an admin-made plan yet. */
export function parseEntitlement(json: unknown): Entitlement | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null
  const j = json as Record<string, unknown>
  if (!Array.isArray(j.modules)) return null
  const modules = j.modules.filter(isModuleKey)
  if (!modules.includes("core")) modules.unshift("core")
  return {
    planId: typeof j.planId === "string" ? j.planId : null,
    modules,
    features: cleanFeatureRules(j.features),
    limits: cleanLimits(j.limits),
    status: (SUBSCRIPTION_STATES as readonly unknown[]).includes(j.status) ? (j.status as SubscriptionState) : "active",
  }
}

/** Whether adding one more would pass the plan's limit (no limit = never). */
export function atLimit(limits: Limits, key: keyof Limits, current: number): boolean {
  const max = limits[key]
  return max !== undefined && current >= max
}
