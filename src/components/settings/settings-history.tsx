import { getTranslations } from "next-intl/server"
import type { AuditEntry } from "@prisma/client"
import { isFeatureKey } from "@/domain/features"
import { isSettingKey, SETTINGS, type SettingDef } from "@/domain/settings"

/** Recent changes to the farm's settings and switches: when, who, what, from what to what. */
export async function SettingsHistory({ entries, locale }: { entries: AuditEntry[]; locale: string }) {
  const t = await getTranslations("settings")
  const tf = await getTranslations("farm.features")
  const when = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })

  const valueOf = (j: unknown) => (j && typeof j === "object" && "value" in j ? (j as { value: unknown }).value : j)
  const words = (key: string, v: unknown) => {
    if (v === null || v === undefined) return t("usual")
    if (typeof v === "boolean") return v ? t("on") : t("off")
    if (isSettingKey(key)) {
      const d = SETTINGS[key] as SettingDef
      if (d.type === "number") return d.unit === "rupees" ? `₹${Number(v).toLocaleString("en-IN")}` : `${v} ${t(`units.${d.unit}`)}`
      if (d.type === "choice") return t(`choices.${key}.${v}`)
    }
    return String(v)
  }
  const what = (e: AuditEntry) => {
    const k = e.subject ?? ""
    if (e.action === "feature.switched" && isFeatureKey(k)) return tf(`${k}.title`)
    if (isSettingKey(k)) return t(`${k}.label`)
    return k
  }

  return (
    <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-bold">{t("history")}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">
          {entries.map((e) => (
            <li key={e.id} className="py-2">
              <span className="block text-muted-foreground tabular-nums">
                {when.format(e.createdAt)} · {e.viaSupport ? t("bySupport") : (e.actorName ?? t("byApp"))}
              </span>
              <span className="block">
                <b>{what(e)}</b>: {words(e.subject ?? "", valueOf(e.before))} → {words(e.subject ?? "", valueOf(e.after))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
