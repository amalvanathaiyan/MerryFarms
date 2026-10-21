import { notFound } from "next/navigation"
import type { FeatureKey, Plan } from "@/domain/features"
import { featuresOf } from "@/lib/features"

/** For pages that only exist when a feature is on. */
export function requireFeature(tenant: { plan: Plan; features: unknown }, key: FeatureKey) {
  if (!featuresOf(tenant)[key]) notFound()
}
