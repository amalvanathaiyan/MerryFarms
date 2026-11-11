import { getLocale, getTranslations } from "next-intl/server"
import { LifeBuoy } from "lucide-react"
import { listVisits } from "@/server/support"

/**
 * The farm admin's record of FarmForYou support visits: who came, why, when, and what they changed (counted by
 * area: orders, products, money…). Shown on Account to farm admins, and on the farm's page in FarmForYou admin.
 */
export async function SupportLog({ tenantId, forAdmin = false }: { tenantId: string; forAdmin?: boolean }) {
  const t = await getTranslations("farm.support")
  const locale = await getLocale()
  const visits = await listVisits(tenantId)
  if (!forAdmin && visits.length === 0) return null
  const when = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
  const time = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-5 shrink-0 text-primary" aria-hidden />
        <h2 className="text-lg leading-tight font-bold">{t("logTitle")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("logHint")}</p>
      {visits.length === 0 && <p className="text-muted-foreground">{t("logEmpty")}</p>}
      <ul className="flex flex-col divide-y">
        {visits.map((v) => {
          return (
            <li key={v.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">{v.adminName}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {when.format(v.createdAt)}
                  {v.finishedAt ? ` – ${time.format(v.finishedAt)}` : ""}
                  {v.open && <span className="ml-2 rounded-full bg-yolk px-2 py-0.5 text-xs font-bold text-yolk-foreground">{t("openNow")}</span>}
                </span>
              </div>
              <p className="break-words">“{v.reason}”</p>
              <p className="text-sm text-muted-foreground">
                {v.total === 0 ? t("noChanges") : v.changes.map((c) => t(`change_${c.kind}`, { count: c.count, area: t(`area_${c.area}`) })).join(" · ")}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
