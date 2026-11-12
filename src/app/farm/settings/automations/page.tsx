import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { recipeSettings } from "@/server/automation"
import { RECIPE_KEYS, RECIPES } from "@/domain/automations"
import { SectionHeader } from "@/components/farm/section-header"
import { AutomationForm } from "@/components/farm/automation-form"

/** Settings · Automations (owner): what the app watches for the farm, and when it tells staff. */
export default async function SettingsAutomationsPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("automations")
  const settings = await recipeSettings(tenant.id)
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(featuresOf(tenant))} active="automations" back={{ href: "/farm/more" }} />
      <p className="text-muted-foreground">{t("farmHint")}</p>
      {RECIPE_KEYS.filter((k) => RECIPES[k].scope === "farm").map((k) => (
        <AutomationForm key={k} recipe={k} enabled={settings[k].enabled} params={settings[k].params} lockedOff={settings[k].lockedOff} who="farm" />
      ))}
    </div>
  )
}
