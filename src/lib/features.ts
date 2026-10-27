import { parseChoices, resolveFeatures, type FeatureSet, type Plan } from "@/domain/features"

/**
 * What is switched on for this farm (plan allows it AND the farm turned it on).
 * Safe to use anywhere on the server; pages that 404 when a feature is off use
 * requireFeature from "@/lib/require-feature".
 */
export function featuresOf(tenant: { plan: Plan; features: unknown }): FeatureSet {
  return resolveFeatures(tenant.plan, parseChoices(tenant.features))
}
