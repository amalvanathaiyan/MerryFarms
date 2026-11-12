import { FEATURE_KEYS, FEATURES, parseChoices, planAllows, resolveFeatures, type FeatureSet, type FeatureSource, type Plan } from "@/domain/features"
import { parseEntitlement } from "@/domain/entitlements"
import { MODULE_KEYS, type Limits, type ModuleKey } from "@/domain/modules"

type FarmFeatures = { plan: Plan; features: unknown; entitlements?: unknown }

/** What the farm may use: its admin-made plan's entitlement, or, until it has one, its old plan level. */
export function featureSource(tenant: FarmFeatures): FeatureSource {
  return parseEntitlement(tenant.entitlements) ?? tenant.plan
}

/**
 * What is switched on for this farm (its plan allows it AND the farm turned it on, or the plan forces it).
 * Safe to use anywhere on the server; pages that 404 when a feature is off use requireFeature from
 * "@/lib/require-feature".
 */
export function featuresOf(tenant: FarmFeatures): FeatureSet {
  return resolveFeatures(featureSource(tenant), parseChoices(tenant.features))
}

/**
 * The farm's modules: its admin-made plan's, or, until it has one, Farm Core, Selling and any module whose features
 * its old plan level includes.
 */
export function farmModules(tenant: FarmFeatures): ModuleKey[] {
  const source = featureSource(tenant)
  if (typeof source !== "string") return source.modules
  const set = new Set<ModuleKey>(["core", "selling"])
  for (const k of FEATURE_KEYS) if (FEATURES[k].available && planAllows(source, k)) set.add(FEATURES[k].module)
  return MODULE_KEYS.filter((m) => set.has(m))
}

/** The farm's plan limits (products, staff, orders a month, video space); none until it's on an admin-made plan. */
export function planLimits(tenant: { entitlements?: unknown }): Limits {
  return parseEntitlement(tenant.entitlements)?.limits ?? {}
}
