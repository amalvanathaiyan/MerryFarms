import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { moduleSettings } from "@/server/subscriptions"
import { MODULES } from "@/domain/modules"
import { ModuleSettingForm } from "./module-setting-form"

/** Every module: on or off for the whole platform, its price and trial as an add-on, and how many farms have it. */
export default async function AdminModulesPage() {
  const t = await getTranslations("admin.modules")
  const settings = await moduleSettings()
  const farms = await prisma.tenant.findMany({ select: { entitlements: true } })
  const using = (key: string) => farms.filter((f) => Array.isArray((f.entitlements as { modules?: unknown } | null)?.modules) && ((f.entitlements as { modules: string[] }).modules.includes(key))).length
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {settings.map((s) => (
          <ModuleSettingForm
            key={s.key}
            setting={{ ...s, addOnMonthlyRupees: s.addOnMonthlyPaise === null ? null : s.addOnMonthlyPaise / 100, addOnYearlyRupees: s.addOnYearlyPaise === null ? null : s.addOnYearlyPaise / 100 }}
            alwaysOn={MODULES[s.key].alwaysOn}
            available={MODULES[s.key].available}
            farmsUsing={using(s.key)}
          />
        ))}
      </div>
    </div>
  )
}
