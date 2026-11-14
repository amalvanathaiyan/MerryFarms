import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronRight, Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { adminDashboard } from "@/server/admin-overview"
import { Button } from "@/components/ui/button"
import { AuditRows, Panel, Tile, whenFormat } from "./admin-ui"

/**
 * Admin · Dashboard: the whole platform at a glance. Farms and their state, monthly fees, trials ending this week,
 * orders and sales across farms, requests waiting, the automation engine, and the latest changes. Each opens where
 * it can be looked into.
 */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ support?: string }> }) {
  const { support } = await searchParams
  const t = await getTranslations("admin.dashboard")
  const ta = await getTranslations("admin")
  const locale = await getLocale()
  const when = await whenFormat()
  const d = await adminDashboard()
  const farms = await prisma.tenant.findMany({ select: { id: true, nameTa: true, nameEn: true } })
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })

  return (
    <div className="flex flex-col gap-5">
      {support === "ended" && (
        <p role="status" className="rounded-xl bg-yolk p-3 font-medium text-yolk-foreground">
          {ta("support.ended")}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("hint")}</p>
        </div>
        <Button asChild size="lg" className="h-12 bg-sun text-base text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
          <Link href="/admin/farms/new">
            <Plus /> {ta("newFarm")}
          </Link>
        </Button>
      </div>

      <section aria-label={t("farmsTitle")} className="flex flex-col gap-2">
        <h2 className="font-bold">{t("farmsTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile label={t("farmsAll")} value={d.farms.total} sub={t("new30", { count: d.farms.new30 })} href="/admin/farms" />
          <Tile label={ta("status_active")} value={d.farms.active} tone={d.farms.active > 0 ? "good" : undefined} />
          <Tile label={ta("status_trial")} value={d.farms.trial} />
          <Tile label={ta("status_trial_over")} value={d.farms.trialOver} tone={d.farms.trialOver > 0 ? "warn" : undefined} href="/admin/farms" />
          <Tile label={ta("status_suspended")} value={d.farms.suspended} />
          <Tile label={t("quietFarms")} value={d.selling.quietFarms} sub={t("quietHint")} tone={d.selling.quietFarms > 0 ? "warn" : undefined} />
        </div>
      </section>

      <section aria-label={t("moneyTitle")} className="flex flex-col gap-2">
        <h2 className="font-bold">{t("moneyTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t("monthlyFees")} value={formatRupees(d.subscriptions.monthlyPaise)} sub={t("monthlyFeesHint")} />
          <Tile label={t("paying")} value={d.subscriptions.byStatus.active} />
          <Tile label={t("pastDue")} value={d.subscriptions.byStatus.past_due} tone={d.subscriptions.byStatus.past_due > 0 ? "bad" : undefined} />
          <Tile label={t("onTrial")} value={d.subscriptions.byStatus.trial} />
        </div>
      </section>

      <section aria-label={t("sellingTitle")} className="flex flex-col gap-2">
        <h2 className="font-bold">{t("sellingTitle")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Tile label={ta("orders30")} value={d.selling.orders30} />
          <Tile label={ta("sales30")} value={formatRupees(d.selling.sales30Paise)} />
          <Tile label={t("newCustomers30")} value={d.selling.newCustomers30} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("trialsTitle")} hint={t("trialsHint")}>
          {d.subscriptions.trialsEnding.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("trialsNone")}</p>
          ) : (
            <ul className="divide-y">
              {d.subscriptions.trialsEnding.map((s) => (
                <li key={s.tenantId}>
                  <Link href={`/admin/farms/${s.tenantId}`} className="flex items-center justify-between gap-3 py-2 hover:text-primary">
                    <span className="min-w-0">
                      <span className="block font-semibold">{pick(locale, s.nameTa, s.nameEn)}</span>
                      <span className="block text-sm text-muted-foreground">{pick(locale, s.planTa, s.planEn)}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-yolk px-2.5 py-0.5 text-sm font-semibold text-yolk-foreground">{t("endsOn", { day: day.format(s.endsAt) })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t("requestsTitle")}
          hint={t("requestsWaiting", { count: d.requests.pending })}
          action={
            <Link href="/admin/requests" className="flex items-center gap-0.5 text-sm font-semibold text-primary">
              {t("open")} <ChevronRight className="size-4" aria-hidden />
            </Link>
          }
        >
          {d.requests.latest.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("requestsNone")}</p>
          ) : (
            <ul className="divide-y">
              {d.requests.latest.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold">{pick(locale, r.tenant.nameTa, r.tenant.nameEn)}</span>
                    <span className="block text-sm text-muted-foreground">{t.has(`request_${r.kind}`) ? t(`request_${r.kind}`) : r.kind}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{when.format(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={t("engineTitle")}
          action={
            <Link href="/admin/tech" className="flex items-center gap-0.5 text-sm font-semibold text-primary">
              {t("techMonitor")} <ChevronRight className="size-4" aria-hidden />
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <Tile
              label={t("tick")}
              value={t(`tick_${d.automation.tick}`)}
              sub={d.automation.lastTickAt ? when.format(d.automation.lastTickAt) : undefined}
              tone={d.automation.tick === "running" ? "good" : "warn"}
            />
            <Tile label={t("failedJobs")} value={d.automation.failedJobs24h} tone={d.automation.failedJobs24h > 0 ? "bad" : undefined} href="/admin/automation" />
            <Tile label={t("alertsSent")} value={d.automation.alerts24h} />
          </div>
        </Panel>

        <Panel
          title={t("recentTitle")}
          action={
            <Link href="/admin/audit" className="flex items-center gap-0.5 text-sm font-semibold text-primary">
              {t("auditLog")} <ChevronRight className="size-4" aria-hidden />
            </Link>
          }
        >
          <AuditRows rows={d.recent} farms={farms} compact />
        </Panel>
      </div>
    </div>
  )
}
