import { notFound } from "next/navigation"
import { parseChoices, resolveFeatures, type FeatureKey, type FeatureSet, type Plan } from "@/domain/features"

/** What is switched on for this farm (plan allows it AND the farm turned it on). */
export function featuresOf(tenant: { plan: Plan; features: unknown }): FeatureSet {
  return resolveFeatures(tenant.plan, parseChoices(tenant.features))
}

/** For pages that only exist when a feature is on. */
export function requireFeature(tenant: { plan: Plan; features: unknown }, key: FeatureKey) {
  if (!featuresOf(tenant)[key]) notFound()
}
