/**
 * Per-farm feature switches.
 *
 * Two layers decide whether a feature is on:
 *   1. The plan decides which features a farm MAY use (the platform's call).
 *   2. The farm owner switches each allowed feature on or off (the farm's call).
 * A feature is on only when both say yes, and only once it is built.
 *
 * Adding a feature: add it to FEATURES, add its Tamil/English labels under
 * farm.features in messages/*.json, and gate the code with `features.<key>`.
 */

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
  | "whatsappLite"
  | "upiPayments"
  | "subscriptions"
  | "broadcasts"
  | "whatsappCloud"
  | "reports"

export interface FeatureDef {
  /** On for a new farm (if its plan allows it). */
  defaultOn: boolean
  /** Lowest plan that includes it. */
  minPlan: Plan
  /** Other features that must be on for this one to work. */
  requires: FeatureKey[]
  /** Built and usable today; false shows it as "coming soon". */
  available: boolean
}

export const FEATURES: Record<FeatureKey, FeatureDef> = {
  webShop: { defaultOn: true, minPlan: "free", requires: [], available: true },
  callConfirmation: { defaultOn: true, minPlan: "free", requires: [], available: true },
  stockTracking: { defaultOn: true, minPlan: "free", requires: [], available: true },
  creditAccounts: { defaultOn: true, minPlan: "free", requires: [], available: true },
  invoices: { defaultOn: true, minPlan: "free", requires: [], available: true },
  returns: { defaultOn: true, minPlan: "free", requires: [], available: true },
  deliveryArea: { defaultOn: true, minPlan: "free", requires: [], available: true },
  customerAccounts: { defaultOn: true, minPlan: "free", requires: [], available: true },
  messages: { defaultOn: true, minPlan: "free", requires: ["customerAccounts"], available: true },
  pushNotifications: { defaultOn: true, minPlan: "free", requires: [], available: true },
  whatsappLite: { defaultOn: true, minPlan: "free", requires: [], available: true },
  upiPayments: { defaultOn: true, minPlan: "free", requires: [], available: true },
  // Off by default: many small farms can't promise eggs every week.
  subscriptions: { defaultOn: false, minPlan: "growth", requires: [], available: true },
  broadcasts: { defaultOn: false, minPlan: "growth", requires: ["whatsappCloud"], available: false },
  whatsappCloud: { defaultOn: false, minPlan: "starter", requires: [], available: false },
  reports: { defaultOn: true, minPlan: "free", requires: [], available: true },
}

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

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

/** What is actually on for a farm. */
export function resolveFeatures(plan: Plan, choices: Partial<FeatureSet>): FeatureSet {
  const raw = {} as FeatureSet
  for (const k of FEATURE_KEYS) {
    const def = FEATURES[k]
    raw[k] = def.available && planAllows(plan, k) && (choices[k] ?? def.defaultOn)
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

/** Why a farm can't switch a feature on, or null if it can. */
export function cannotEnable(plan: Plan, key: FeatureKey): "coming_soon" | "plan" | null {
  if (!FEATURES[key].available) return "coming_soon"
  if (!planAllows(plan, key)) return "plan"
  return null
}
