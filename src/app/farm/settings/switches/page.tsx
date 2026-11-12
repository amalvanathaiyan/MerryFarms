import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { cannotEnable, FEATURE_KEYS, FEATURES, parseChoices, resolveFeatures } from "@/domain/features"
import { featureSource, featuresOf } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { FeatureSwitches, type FeatureRow } from "@/components/farm/feature-switches"
import { SectionHeader } from "@/components/farm/section-header"

/** Settings · Switches (owner): turn the farm's features on or off, within what its plan allows. */
export default async function SettingsSwitchesPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const choices = parseChoices(tenant.features)
  const source = featureSource(tenant)
  const resolved = resolveFeatures(source, choices)
  const rows: FeatureRow[] = FEATURE_KEYS.map((key) => {
    const locked = cannotEnable(source, key)
    const chosen = choices[key] ?? FEATURES[key].defaultOn
    return {
      key,
      on: locked === "forced" ? true : locked ? false : chosen,
      locked,
      blockedBy: !locked && chosen && !resolved[key] ? (FEATURES[key].requires.find((r) => !resolved[r]) ?? null) : null,
    }
  })
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(featuresOf(tenant))} active="switches" back={{ href: "/farm/more" }} />
      <FeatureSwitches rows={rows} />
    </div>
  )
}
