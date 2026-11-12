import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import Link from "next/link"
import { SlidersHorizontal } from "lucide-react"

/** The automation engine: whether the tick is running, failed jobs, recent events. Recipes' defaults are in Settings. */
export default async function AdminAutomationPage() {
  const t = await getTranslations("automations")
  const locale = await getLocale()
  const [ticks, failed, events, farms] = await Promise.all([
    prisma.job.findMany({ where: { type: "tick" }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.job.findMany({ where: { status: "failed", type: { not: "tick" } }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.tenant.findMany({ select: { id: true, nameTa: true, nameEn: true } }),
  ])
  const when = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
  const farmName = (id: string | null) => {
    const f = farms.find((x) => x.id === id)
    return f ? pick(locale, f.nameTa, f.nameEn) : "Farm For You"
  }
  const lastTick = ticks[0]
  // eslint-disable-next-line react-hooks/purity -- a server page, drawn once per request
  const stale = !lastTick || Date.now() - lastTick.createdAt.getTime() > 30 * 60_000

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("adminTitle")}</h1>
        <p className="text-muted-foreground">{t("adminHint")}</p>
      </div>

      <section className={stale ? "rounded-2xl bg-yolk p-4 text-yolk-foreground" : "rounded-2xl border bg-card p-4"}>
        <h2 className="font-bold">{t("engine")}</h2>
        <p className="text-sm">{lastTick ? t("lastTick", { when: when.format(lastTick.createdAt), status: lastTick.status }) : t("neverTicked")}</p>
        {stale && <p className="mt-1 text-sm">{t("staleHint")}</p>}
        {ticks.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-xs tabular-nums">
            {ticks.map((j) => (
              <li key={j.id}>
                {when.format(j.createdAt)} · {j.status} ·{" "}
                {Object.entries((j.payload ?? {}) as Record<string, number>)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/admin/settings" className="flex min-h-11 items-center gap-2 self-start rounded-xl border bg-card px-4 font-semibold text-primary hover:border-primary">
        <SlidersHorizontal className="size-5" aria-hidden /> {t("settingsLink")}
      </Link>

      {failed.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="font-bold">{t("failedJobs")}</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {failed.map((j) => (
              <li key={j.id}>
                {when.format(j.updatedAt)} · {j.type} · {farmName(j.tenantId)} · {j.lastError}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">{t("recentEvents")}</h2>
        {events.length === 0 && <p className="text-sm text-muted-foreground">{t("noEvents")}</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-muted-foreground tabular-nums">{when.format(e.createdAt)}</span> · <b>{e.type}</b> · {farmName(e.tenantId)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
