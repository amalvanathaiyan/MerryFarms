import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Download } from "lucide-react"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { moneyTabs } from "@/lib/farm-sections"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { duesList, loadReport } from "@/server/reports"
import { Button } from "@/components/ui/button"
import { DailySalesChart } from "@/components/farm/daily-sales-chart"
import { SectionHeader } from "@/components/farm/section-header"
import { pickRange, RangePicker } from "@/components/farm/range-picker"
import { cn } from "@/lib/utils"

/** Money · Sales (owner): what came in from orders in the period, and the files for the accountant. */
export default async function MoneySalesPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "reports")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.reports")
  const to = await getTranslations("farm.orders")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const { key, range } = pickRange(sp)

  const [report, dues] = await Promise.all([loadReport(tenant.id, range.from, range.to), features.creditAccounts ? duesList(tenant.id) : Promise.resolve([])])
  const { summary: s, calls } = report
  const shortDay = (d: string) => new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))
  const exportHref = (type: string) => `/farm/reports/export?type=${type}&from=${range.from}&to=${range.to}`
  const accidentalPct = (calls.accidentalRate * 100).toFixed(1)
  const rateOk = calls.accidentalRate < 0.02

  const tiles = [
    { label: t("cash"), value: formatRupees(s.collected.cashPaise) },
    { label: t("upi"), value: formatRupees(s.collected.upiPaise) },
    features.creditAccounts && { label: t("onAccount"), value: formatRupees(s.onAccountPaise) },
    (s.returnsPaise > 0 || features.returns) && { label: t("returns"), value: formatRupees(s.returnsPaise) },
  ].filter((x): x is { label: string; value: string } => !!x)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="money" tabs={moneyTabs({ roles: staff.roles, features })} active="sales" />
      <RangePicker basePath="/farm/money" current={key} range={range} />

      <section className="rounded-2xl border bg-card p-5">
        <div className="font-semibold text-muted-foreground">
          {t("netSales")} · {range.from === range.to ? dayLabel(range.from, locale, labels) : `${shortDay(range.from)} – ${shortDay(range.to)}`}
        </div>
        <div className="font-display text-5xl font-bold tabular-nums">{formatRupees(s.netPaise)}</div>
        <div className="mt-1 text-muted-foreground">
          {t("ordersLine", { count: s.orders, average: formatRupees(s.averagePaise) })}
          {s.returnsPaise > 0 && ` · ${t("afterReturns", { amount: formatRupees(s.returnsPaise) })}`}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border bg-card p-4">
            <div className="text-sm font-semibold text-muted-foreground">{tile.label}</div>
            <div className="text-2xl font-bold tabular-nums">{tile.value}</div>
          </div>
        ))}
      </div>

      {report.daily.length > 1 && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-bold">{t("dailySales")}</h2>
          <DailySalesChart tooltip={t("dailySales")} days={report.daily.map((d) => ({ date: d.date, label: shortDay(d.date), value: formatRupees(d.paise), paise: d.paise }))} />
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{t("asTable")}</summary>
            <table className="mt-2 w-full tabular-nums">
              <tbody>
                {report.daily.map((d) => (
                  <tr key={d.date} className="border-b border-dashed">
                    <td className="py-1">{shortDay(d.date)}</td>
                    <td className="py-1 text-right">{formatRupees(d.paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-bold">{t("products")}</h2>
        {report.products.length === 0 ? (
          <p className="text-muted-foreground">{t("noSales")}</p>
        ) : (
          <ul className="divide-y divide-dashed tabular-nums">
            {report.products.map((p) => (
              <li key={p.productId} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  {p.product ? pick(locale, p.product.nameTa, p.product.nameEn) : "—"}
                  {p.product && <span className="text-muted-foreground"> · {pick(locale, p.product.packTa, p.product.packEn)} × {p.qty}</span>}
                </span>
                <b className="shrink-0">{formatRupees(p.paise)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-bold">{t("byChannel")}</h2>
        {Object.keys(s.byChannel).length === 0 ? (
          <p className="text-muted-foreground">{t("noSales")}</p>
        ) : (
          <ul className="divide-y divide-dashed tabular-nums">
            {Object.entries(s.byChannel)
              .sort(([, a], [, b]) => b.paise - a.paise)
              .map(([channel, c]) => (
                <li key={channel} className="flex justify-between py-2">
                  <span>
                    {to(`channel_${channel}`)} <span className="text-muted-foreground">· {t("ordersCount", { count: c.orders })}</span>
                  </span>
                  <b>{formatRupees(c.paise)}</b>
                </li>
              ))}
          </ul>
        )}
      </section>

      {features.creditAccounts && (
        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">{t("dues")}</h2>
            <span className="font-bold tabular-nums">{formatRupees(dues.reduce((a, d) => a + d.balancePaise, 0))}</span>
          </div>
          {dues.length === 0 ? (
            <p className="text-muted-foreground">{t("noDues")}</p>
          ) : (
            <ul className="divide-y divide-dashed tabular-nums">
              {dues.slice(0, 10).map((d) => (
                <li key={d.customer.id} className="flex justify-between gap-3 py-2">
                  <Link href={`/farm/customers/${d.customer.id}`} className="min-w-0 truncate underline-offset-4 hover:underline">
                    {d.customer.name} <span className="text-muted-foreground">· {formatIndianMobile(d.customer.phone)}</span>
                  </Link>
                  <b className="shrink-0">{formatRupees(d.balancePaise)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {features.callConfirmation && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-bold">{t("calls")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums sm:grid-cols-4">
            <span>
              {to("outcome_confirmed")}: <b>{calls.confirmed}</b>
            </span>
            <span>
              {to("outcome_changed")}: <b>{calls.changed}</b>
            </span>
            <span>
              {to("outcome_cancelled")}: <b>{calls.cancelled}</b>
            </span>
            <span>
              {t("unanswered")}: <b>{calls.noAnswerAttempts}</b>
            </span>
          </div>
          <p className={cn("rounded-lg px-3 py-2 text-sm font-medium", rateOk ? "bg-accent" : "bg-yolk text-yolk-foreground")}>
            {rateOk ? "✓ " : "! "}
            {t("accidental", { pct: accidentalPct })} {rateOk ? t("accidentalOk") : t("accidentalHigh")}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("downloads")}</h2>
        <p className="text-sm text-muted-foreground">{t("downloadsHint")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["sales", "payments", "products", ...(features.creditAccounts ? ["dues"] : []), ...(features.farmRecords ? ["expenses"] : [])] as const).map((type) => (
            <Button key={type} asChild variant="outline" className="h-12 justify-start text-base">
              <a href={exportHref(type)}>
                <Download /> {t(`export_${type}`)}
              </a>
            </Button>
          ))}
        </div>
        <Button asChild variant="outline" className="h-12 justify-start text-base">
          <a href="/farm/export/all">
            <Download /> {t("allDataButton")}
          </a>
        </Button>
        <p className="text-sm text-muted-foreground">{t("allDataHint")}</p>
      </section>
    </div>
  )
}
