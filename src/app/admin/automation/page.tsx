import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { SlidersHorizontal } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { jobEngine } from "@/server/admin-overview"
import { Panel, Tile, whenFormat } from "../admin-ui"

const TICK_URL = "https://github.com/amalvanathaiyan/MerryFarms/actions/workflows/tick.yml"

/**
 * Admin · Automation, the one page for the job engine, in the order it is read: is it running (and what to do if
 * not), the day in four numbers, jobs that failed, then recent activity. Each automation's switch and hours are
 * settings (Settings). The last success of each kind of job is folded away, for when something seems missing.
 */
export default async function AdminAutomationPage() {
  const t = await getTranslations("automations")
  const tt = await getTranslations("admin.tech")
  const locale = await getLocale()
  const when = await whenFormat()
  const [m, events, farms] = await Promise.all([
    jobEngine(),
    prisma.platformEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.tenant.findMany({ select: { id: true, nameTa: true, nameEn: true } }),
  ])
  const farmName = (id: string | null) => {
    const f = farms.find((x) => x.id === id)
    return f ? pick(locale, f.nameTa, f.nameEn) : "Farm For You"
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("adminTitle")}</h1>
        <p className="text-muted-foreground">{t("adminHint")}</p>
      </div>

      <Panel title={tt("jobsTitle")} hint={tt("jobsHint")}>
        {m.tick !== "running" && (
          <p className="rounded-xl bg-yolk px-3 py-2 text-sm text-yolk-foreground">
            {t("staleHint")}{" "}
            <a href={TICK_URL} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">
              {tt("tickWorkflow")}
            </a>
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label={tt("tick")} value={tt(`tick_${m.tick}`)} sub={m.lastTickAt ? when.format(m.lastTickAt) : undefined} tone={m.tick === "running" ? "good" : "warn"} />
          <Tile label={tt("done24h")} value={m.last24h.done ?? 0} />
          <Tile label={tt("failed24h")} value={m.last24h.failed ?? 0} tone={(m.last24h.failed ?? 0) > 0 ? "bad" : undefined} />
          <Tile label={tt("waiting")} value={m.waiting} tone={m.waiting > 20 ? "warn" : undefined} />
        </div>
        {m.lastDone.length > 0 && (
          <details className="text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">{tt("lastSuccess")}</summary>
            <ul className="divide-y">
              {m.lastDone.map((j) => (
                <li key={j.type} className="flex justify-between gap-3 py-1.5">
                  <span className="font-mono">{j.type}</span>
                  <span className="text-muted-foreground tabular-nums">{j.at ? when.format(j.at) : "—"}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>

      {m.failures.length > 0 && (
        <Panel title={t("failedJobs")}>
          <ul className="divide-y text-sm">
            {m.failures.map((j) => (
              <li key={j.id} className="flex flex-col gap-0.5 py-2">
                <span className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold">
                    <span className="font-mono">{j.type}</span> · {farmName(j.tenantId)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{when.format(j.updatedAt)}</span>
                </span>
                {j.lastError && <span className="text-xs break-words text-muted-foreground">{j.lastError.slice(0, 200)}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={t("recentEvents")}>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                <span>
                  <b>{e.type}</b> · {farmName(e.tenantId)}
                </span>
                <span className="text-muted-foreground tabular-nums">{when.format(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Link href="/admin/settings" className="flex min-h-11 items-center gap-2 self-start rounded-xl border bg-card px-4 font-semibold text-primary hover:border-primary">
        <SlidersHorizontal className="size-5 shrink-0" aria-hidden /> {t("settingsLink")}
      </Link>
    </div>
  )
}
