import { parseChoices, resolveFeatures, type FeatureSet, type FeatureSource, type Plan } from "@/domain/features"
import { parseEntitlement } from "@/domain/entitlements"
import type { Limits } from "@/domain/modules"

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

/** The farm's plan limits (products, staff, orders a month, video space); none until it's on an admin-made plan. */
export function planLimits(tenant: { entitlements?: unknown }): Limits {
  return parseEntitlement(tenant.entitlements)?.limits ?? {}
}
