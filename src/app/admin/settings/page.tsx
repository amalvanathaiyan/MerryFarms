import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { MODULE_KEYS } from "@/domain/modules"
import { groupsOf, SETTINGS, type AnyValue, type SettingDef } from "@/domain/settings"
import { platformSettingsOverview } from "@/server/settings"
import { recentAudit } from "@/server/audit"
import { AdminSettingRow } from "@/components/settings/admin-setting-row"
import { ModuleIcon } from "@/components/settings/module-icon"

/**
 * Farm For You admin · Settings: every setting in the registry, by module and heading. The value every farm gets,
 * and whether it is locked, hidden or offered to chosen farms first. Recent changes below.
 */
export default async function AdminSettingsPage() {
  const t = await getTranslations("settings")
  const ta = await getTranslations("settings.admin")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const [overview, farms, history] = await Promise.all([
    platformSettingsOverview(),
    prisma.tenant.findMany({ select: { id: true, nameTa: true, nameEn: true }, orderBy: { createdAt: "asc" } }),
    recentAudit(null, { actions: ["setting.changed", "setting.control"], take: 15 }),
  ])
  const farmList = farms.map((f) => ({ id: f.id, name: pick(locale, f.nameTa, f.nameEn) }))
  const when = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{ta("title")}</h1>
        <p className="text-muted-foreground">{ta("hint")}</p>
      </div>
      {MODULE_KEYS.map((m) => {
        const groups = groupsOf(m)
        if (!groups.length) return null
        return (
          <section key={m} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <ModuleIcon module={m} className="size-6 text-primary" /> {tm(m)}
            </h2>
            {groups.map((g) => (
              <section key={g.group} className="rounded-2xl border bg-card p-4">
                <h3 className="text-lg font-bold">{t(`groups.${g.group}.title`)}</h3>
                <ul className="flex flex-col divide-y">
                  {g.keys.map((k) => {
                    const d = SETTINGS[k] as SettingDef
                    const o = overview.find((x) => x.key === k)!
                    return (
                      <AdminSettingRow
                        key={k}
                        def={{
                          key: k,
                          type: d.type,
                          default: d.default,
                          platformOnly: d.who === "platform",
                          ...(d.type === "number" ? { min: d.min, max: d.max, step: d.step, unit: d.unit } : {}),
                          ...(d.type === "choice" ? { choices: d.choices } : {}),
                        }}
                        platformValue={o.resolved.from === "platform" ? (o.resolved.value as AnyValue) : null}
                        control={o.control}
                        farmsOwn={o.farmsOwn}
                        farms={farmList}
                      />
                    )
                  })}
                </ul>
              </section>
            ))}
          </section>
        )
      })}
      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("history")}</h2>
        {history.length === 0 && <p className="text-sm text-muted-foreground">{t("noHistory")}</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {history.map((e) => (
            <li key={e.id}>
              <span className="text-muted-foreground tabular-nums">{when.format(e.createdAt)}</span> · {e.actorName ?? "—"} · <b>{e.subject && e.subject in SETTINGS ? t(`${e.subject}.label`) : e.subject}</b> ·{" "}
              {e.action === "setting.control" ? ta("controlChanged") : ta("valueChanged")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
