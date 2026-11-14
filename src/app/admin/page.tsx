import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { CircleCheck, ChevronRight } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { adminDashboard } from "@/server/admin-overview"
import { AuditRows, Panel, Tile } from "./admin-ui"

/**
 * Admin · Dashboard, in the order it is read:
 *   1. Needs you: only what wants action now, each line opening where it is dealt with; "nothing" when all is well.
 *   2. At a glance: four numbers (farms, monthly fees, orders, sales), each once.
 *   3. Latest changes, with the full audit log one tap away.
 * Farm states, plans and the engine's health each have their own page (Farms, Plans, Tech); they are not repeated here.
 */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ support?: string }> }) {
  const { support } = await searchParams
  const t = await getTranslations("admin.dashboard")
  const ta = await getTranslations("admin")
  const locale = await getLocale()
  const d = await adminDashboard()
  const farms = await prisma.tenant.findMany({ select: { id: true, nameTa: true, nameEn: true } })
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })

  // Each line: what is wrong, in words, and where to deal with it. Only lines with something in them.
  const needs: { key: string; text: string; href: string; tone: "warn" | "bad" }[] = [
    ...d.subscriptions.trialsEnding.map((s) => ({
      key: `trial-${s.tenantId}`,
      text: t("needTrialEnds", { farm: pick(locale, s.nameTa, s.nameEn), day: day.format(s.endsAt) }),
      href: `/admin/farms/${s.tenantId}`,
      tone: "warn" as const,
    })),
    ...(d.farms.trialOver > 0 ? [{ key: "trial-over", text: t("needTrialOver", { count: d.farms.trialOver }), href: "/admin/farms?show=trial_over", tone: "warn" as const }] : []),
    ...(d.subscriptions.byStatus.past_due > 0 ? [{ key: "past-due", text: t("needPastDue", { count: d.subscriptions.byStatus.past_due }), href: "/admin/farms", tone: "bad" as const }] : []),
    ...(d.requests.pending > 0 ? [{ key: "requests", text: t("needRequests", { count: d.requests.pending }), href: "/admin/requests", tone: "warn" as const }] : []),
    ...(d.selling.quietFarms > 0 ? [{ key: "quiet", text: t("needQuiet", { count: d.selling.quietFarms }), href: "/admin/farms?show=quiet", tone: "warn" as const }] : []),
    ...(d.automation.tick !== "running" ? [{ key: "tick", text: t("needTick"), href: "/admin/automation", tone: "bad" as const }] : []),
    ...(d.automation.failedJobs24h > 0 ? [{ key: "failed", text: t("needFailed", { count: d.automation.failedJobs24h }), href: "/admin/automation", tone: "bad" as const }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      {support === "ended" && (
        <p role="status" className="rounded-xl bg-yolk p-3 font-medium text-yolk-foreground">
          {ta("support.ended")}
        </p>
      )}
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>

      <section aria-labelledby="needs" className="flex flex-col gap-2">
        <h2 id="needs" className="text-lg font-bold">
          {t("needsTitle")}
        </h2>
        {needs.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-accent p-4 font-medium">
            <CircleCheck className="size-5 shrink-0 text-primary" aria-hidden /> {t("allGood")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {needs.map((n) => (
              <li key={n.key}>
                <Link
                  href={n.href}
                  className={
                    n.tone === "bad"
                      ? "flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-4 py-3 font-semibold text-destructive hover:underline"
                      : "flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-yolk px-4 py-3 font-semibold text-yolk-foreground hover:underline"
                  }
                >
                  <span className="min-w-0">{n.text}</span>
                  <ChevronRight className="size-5 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="glance" className="flex flex-col gap-2">
        <h2 id="glance" className="text-lg font-bold">
          {t("glanceTitle")}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label={t("farmsAll")} value={d.farms.total} sub={t("new30", { count: d.farms.new30 })} href="/admin/farms" />
          <Tile label={t("monthlyFees")} value={formatRupees(d.subscriptions.monthlyPaise)} sub={t("payingFarms", { count: d.subscriptions.byStatus.active })} />
          <Tile label={ta("orders30")} value={d.selling.orders30} sub={t("newCustomers", { count: d.selling.newCustomers30 })} />
          <Tile label={ta("sales30")} value={formatRupees(d.selling.sales30Paise)} />
        </div>
      </section>

      <Panel
        title={t("recentTitle")}
        action={
          <Link href="/admin/audit" className="flex min-h-11 items-center gap-0.5 text-sm font-semibold text-primary">
            {t("auditLog")} <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      >
        <AuditRows rows={d.recent} farms={farms} compact />
      </Panel>
    </div>
  )
}
