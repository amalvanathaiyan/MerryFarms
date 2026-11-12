import { getLocale, getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { cannotEnable, FEATURE_KEYS, FEATURES, parseChoices, resolveFeatures } from "@/domain/features"
import { featureSource, featuresOf, farmModules } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { groupsOf, SETTINGS, shownToFarm, type SettingDef } from "@/domain/settings"
import { loadSettings } from "@/server/settings"
import { recentAudit } from "@/server/audit"
import { SectionHeader } from "@/components/farm/section-header"
import { FeatureSwitches, type FeatureRow } from "@/components/farm/feature-switches"
import { SettingsGroupForm, type FarmSettingRow } from "@/components/settings/settings-group-form"
import { SettingsHistory } from "@/components/settings/settings-history"
import { ModuleIcon } from "@/components/settings/module-icon"

/**
 * Settings · Choices (owner): everything the farm can switch or set, grouped by module. Drawn from the settings
 * registry (src/domain/settings.ts) and the feature list, so a new setting or feature appears here by itself.
 */
export default async function SettingsChoicesPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("settings")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const features = featuresOf(tenant)
  const modules = farmModules(tenant)
  const [settings, history] = await Promise.all([loadSettings(tenant.id), recentAudit(tenant.id, { actions: ["setting.changed", "feature.switched"], take: 12 })])

  // Feature switches, as on the old Switches page
  const choices = parseChoices(tenant.features)
  const source = featureSource(tenant)
  const resolved = resolveFeatures(source, choices)
  const featureRows: FeatureRow[] = FEATURE_KEYS.map((key) => {
    const locked = cannotEnable(source, key)
    const chosen = choices[key] ?? FEATURES[key].defaultOn
    return {
      key,
      on: locked === "forced" ? true : locked ? false : chosen,
      locked,
      blockedBy: !locked && chosen && !resolved[key] ? (FEATURES[key].requires.find((r) => !resolved[r]) ?? null) : null,
    }
  })

  const sections = modules
    .map((m) => {
      // A module's features the farm can see: in its plan, or coming soon (so it knows what's on the way)
      const switches = featureRows.filter((r) => FEATURES[r.key].module === m && r.locked !== "plan")
      const groups = groupsOf(m)
        .map((g) => ({
          group: g.group,
          rows: g.keys
            .filter((k) => shownToFarm(k, settings[k], modules, features))
            .map((k): FarmSettingRow => {
              const d = SETTINGS[k] as SettingDef
              const r = settings[k]
              return {
                key: k,
                type: d.type,
                ...(d.type === "number" ? { min: d.min, max: d.max, step: d.step, unit: d.unit } : {}),
                ...(d.type === "choice" ? { choices: d.choices } : {}),
                shownWhen: d.shownWhen,
                value: r.value,
                usual: r.usual,
                from: r.from,
                locked: r.locked,
              }
            }),
        }))
        .filter((g) => g.rows.length > 0)
      return { module: m, switches, groups }
    })
    .filter((s) => s.switches.length > 0 || s.groups.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(features)} active="choices" back={{ href: "/farm/more" }} />
      <p className="text-muted-foreground">{t("farmHint")}</p>
      {sections.map((s) => (
        <section key={s.module} className="flex flex-col gap-3" aria-labelledby={`module-${s.module}`}>
          <h2 id={`module-${s.module}`} className="flex items-center gap-2 pt-2 text-xl font-bold">
            <ModuleIcon module={s.module} className="size-6 text-primary" /> {tm(s.module)}
          </h2>
          {s.switches.length > 0 && <FeatureSwitches rows={s.switches} title={t("switchesTitle")} hint={t("switchesHint")} />}
          {s.groups.map((g) => (
            <SettingsGroupForm key={g.group} group={g.group} rows={g.rows} />
          ))}
        </section>
      ))}
      <SettingsHistory entries={history} locale={locale} />
    </div>
  )
}
