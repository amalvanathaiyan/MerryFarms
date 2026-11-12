/**
 * Per-farm feature switches.
 *
 * Two layers decide whether a feature is on:
 *   1. What the farm MAY use: its admin-made plan, add-ons and admin overrides (src/domain/entitlements.ts), which
 *      can also force a feature on or off; or, for a farm not yet on such a plan, the old fixed plan level.
 *   2. The farm owner switches each allowed feature on or off (the farm's call), unless the plan forces it.
 * A feature is on only when both say yes, and only once it is built. Each feature belongs to one module.
 *
 * Adding a feature: add it to FEATURES, add its Tamil/English labels under
 * farm.features in messages/*.json, and gate the code with `features.<key>`.
 */

import type { ModuleKey } from "./modules"
import type { Entitlement } from "./entitlements"

export type Plan = "free" | "starter" | "growth" | "pro"

export type FeatureKey =
  | "webShop"
  | "callConfirmation"
  | "stockTracking"
  | "creditAccounts"
  | "invoices"
  | "returns"
  | "deliveryArea"
  | "customerAccounts"
  | "messages"
  | "pushNotifications"
  | "otpLogin"
  | "whatsappAlerts"
  | "farmRecords"
  | "poultryCare"
  | "poultryScenes"
  | "farmVideos"
  | "videoUploads"
  | "whatsappLite"
  | "upiPayments"
  | "subscriptions"
  | "broadcasts"
  | "whatsappCloud"
  | "reports"

export interface FeatureDef {
  /** The one module it belongs to (src/domain/modules.ts). */
  module: ModuleKey
  /** On for a new farm (if its plan allows it). */
  defaultOn: boolean
  /** Lowest of the old fixed plan levels that includes it: used only for farms not yet on an admin-made plan. */
  minPlan: Plan
  /** Other features that must be on for this one to work. */
  requires: FeatureKey[]
  /** Built and usable today; false shows it as "coming soon". */
  available: boolean
}

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  webShop: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  callConfirmation: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  stockTracking: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  creditAccounts: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  invoices: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  returns: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  deliveryArea: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  customerAccounts: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  messages: { module: "selling", defaultOn: true, minPlan: "free", requires: ["customerAccounts"], available: true },
  pushNotifications: { module: "core", defaultOn: true, minPlan: "free", requires: [], available: true },
  otpLogin: { module: "selling", defaultOn: true, minPlan: "free", requires: ["customerAccounts"], available: true },
  whatsappAlerts: { module: "core", defaultOn: true, minPlan: "free", requires: [], available: true },
  farmRecords: { module: "core", defaultOn: true, minPlan: "free", requires: [], available: true },
  // Batches of birds, feed store, losses, per-batch profit and vaccinations: for farms that keep poultry and pay for it.
  poultryCare: { module: "poultry", defaultOn: false, minPlan: "starter", requires: ["farmRecords"], available: true },
  // The shop shows the farm's own live pictures (gate, stall, hen) instead of only FarmForYou's bullock cart.
  poultryScenes: { module: "selling", defaultOn: false, minPlan: "free", requires: [], available: true },
  // Videos on the shop. YouTube links cost the platform nothing, so every farm has them.
  farmVideos: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  // Videos uploaded from the phone use the platform's shared storage: a paid plan, within the farm's space limit.
  videoUploads: { module: "selling", defaultOn: true, minPlan: "starter", requires: ["farmVideos"], available: true },
  whatsappLite: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  upiPayments: { module: "selling", defaultOn: true, minPlan: "free", requires: [], available: true },
  // Off by default: many small farms can't promise eggs every week.
  subscriptions: { module: "selling", defaultOn: false, minPlan: "growth", requires: [], available: true },
  broadcasts: { module: "selling", defaultOn: false, minPlan: "growth", requires: ["whatsappCloud"], available: false },
  whatsappCloud: { module: "selling", defaultOn: false, minPlan: "starter", requires: [], available: false },
  reports: { module: "core", defaultOn: true, minPlan: "free", requires: [], available: true },
}

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]
export const isFeatureKey = (k: unknown): k is FeatureKey => typeof k === "string" && Object.hasOwn(FEATURES, k)

const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, growth: 2, pro: 3 }

export const planAllows = (plan: Plan, key: FeatureKey) => PLAN_RANK[plan] >= PLAN_RANK[FEATURES[key].minPlan]

export type FeatureSet = Record<FeatureKey, boolean>

/** The farm's saved choices, read defensively from JSON (unknown keys and non-booleans ignored). */
export function parseChoices(json: unknown): Partial<FeatureSet> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const out: Partial<FeatureSet> = {}
  for (const k of FEATURE_KEYS) {
    const v = (json as Record<string, unknown>)[k]
    if (typeof v === "boolean") out[k] = v
  }
  return out
}

/** What the farm may use: an entitlement (admin-made plan) or, before one is assigned, the old plan level. */
export type FeatureSource = Plan | Entitlement

/** Whether the source lets the farm have the feature, and whether it forces it on. */
function rule(source: FeatureSource, k: FeatureKey): "off" | "farm" | "on" {
  if (typeof source === "string") return planAllows(source, k) ? "farm" : "off"
  const def = FEATURES[k]
  if (!source.modules.includes(def.module)) return "off"
  return source.features[k] ?? "farm"
}

/** What is actually on for a farm. */
export function resolveFeatures(source: FeatureSource, choices: Partial<FeatureSet>): FeatureSet {
  const raw = {} as FeatureSet
  for (const k of FEATURE_KEYS) {
    const def = FEATURES[k]
    const r = rule(source, k)
    raw[k] = def.available && r !== "off" && (r === "on" || (choices[k] ?? def.defaultOn))
  }
  // A feature whose requirement is off is off too (repeat until stable for chains).
  let changed = true
  while (changed) {
    changed = false
    for (const k of FEATURE_KEYS) {
      if (raw[k] && FEATURES[k].requires.some((r) => !raw[r])) {
        raw[k] = false
        changed = true
      }
    }
  }
  return raw
}

/** Why a farm can't change a feature, or null if it can: not built yet, not in its plan, or fixed on by its plan. */
export function cannotEnable(source: FeatureSource, key: FeatureKey): "coming_soon" | "plan" | "forced" | null {
  if (!FEATURES[key].available) return "coming_soon"
  const r = rule(source, key)
  if (r === "off") return "plan"
  if (r === "on") return "forced"
  return null
}
