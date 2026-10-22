import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Download } from "lucide-react"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { cleanRange, rangeFor, type RangeKey } from "@/domain/reports"
import { duesList, loadReport } from "@/server/reports"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DailySalesChart } from "@/components/farm/daily-sales-chart"
import { cn } from "@/lib/utils"
import { tenantDb } from "@/lib/tenant-db"
import { costs, production, profit } from "@/domain/records"

const PRESETS = ["today", "week", "month"] as const

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams
  const { tenant } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "reports")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.reports")
  const to = await getTranslations("farm.orders")
  const tc = await getTranslations("common")
  const tr = await getTranslations("farm.records")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }

  const now = new Date()
  const custom = sp.range === "custom" ? cleanRange(sp.from, sp.to, now) : null
  const key: RangeKey = custom ? "custom" : PRESETS.includes(sp.range as (typeof PRESETS)[number]) ? (sp.range as RangeKey) : "week"
  const range = custom ?? rangeFor(key as Exclude<RangeKey, "custom">, now)

  const db = tenantDb(tenant.id)
  const inRange = { date: { gte: range.from, lte: range.to } }
  const [report, dues, dayRows, spendRows] = await Promise.all([
    loadReport(tenant.id, range.from, range.to),
    features.creditAccounts ? duesList(tenant.id) : Promise.resolve([]),
    features.farmRecords ? db.dailyRecord.findMany({ where: inRange }) : Promise.resolve([]),
    features.farmRecords ? db.expense.findMany({ where: inRange }) : Promise.resolve([]),
  ])
  const prod = production(dayRows)
  const spent = costs(spendRows, prod)
  const { summary: s, calls } = report
  const shortDay = (d: string) =>
    new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))
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
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-bold">{t("title")}</h1>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Link key={p} href={`/farm/reports?range=${p}`} aria-current={key === p ? "page" : undefined} className={cn("rounded-full border px-4 py-2 text-sm font-medium", key === p ? "border-primary bg-accent" : "bg-card")}>
              {t(`range_${p}`)}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/farm/reports">
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t("from")}
            <Input type="date" name="from" defaultValue={range.from} className="h-10 w-40" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            {t("to")}
            <Input type="date" name="to" defaultValue={range.to} className="h-10 w-40" />
          </label>
          <Button type="submit" variant={key === "custom" ? "default" : "outline"}>
            {t("show")}
          </Button>
        </form>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <div className="text-sm font-medium text-muted-foreground">
          {t("netSales")} · {range.from === range.to ? dayLabel(range.from, locale, labels) : `${shortDay(range.from)} – ${shortDay(range.to)}`}
        </div>
        <div className="text-5xl font-bold">{formatRupees(s.netPaise)}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("ordersLine", { count: s.orders, average: formatRupees(s.averagePaise) })}
          {s.returnsPaise > 0 && ` · ${t("afterReturns", { amount: formatRupees(s.returnsPaise) })}`}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border bg-card p-4">
            <div className="text-sm font-medium text-muted-foreground">{tile.label}</div>
            <div className="text-2xl font-bold tabular-nums">{tile.value}</div>
          </div>
        ))}
      </div>

      {report.daily.length > 1 && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">{t("dailySales")}</h2>
          <DailySalesChart
            tooltip={t("dailySales")}
            days={report.daily.map((d) => ({ date: d.date, label: shortDay(d.date), value: formatRupees(d.paise), paise: d.paise }))}
          />
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
        <h2 className="mb-2 font-semibold">{t("products")}</h2>
        {report.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSales")}</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-semibold">{t("product")}</th>
                <th className="py-2 text-right font-semibold">{t("qty")}</th>
                <th className="py-2 text-right font-semibold">{t("value")}</th>
              </tr>
            </thead>
            <tbody>
              {report.products.map((p) => (
                <tr key={p.productId} className="border-b border-dashed">
                  <td className="py-2">
                    {p.product ? pick(locale, p.product.nameTa, p.product.nameEn) : "—"}
                    {p.product && <span className="text-muted-foreground"> · {pick(locale, p.product.packTa, p.product.packEn)}</span>}
                  </td>
                  <td className="py-2 text-right">{p.qty}</td>
                  <td className="py-2 text-right">{formatRupees(p.paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">{t("byChannel")}</h2>
        {Object.keys(s.byChannel).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSales")}</p>
        ) : (
          <ul className="divide-y divide-dashed text-sm tabular-nums">
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

      {features.callConfirmation && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="font-semibold">{t("calls")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums sm:grid-cols-4">
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

      {features.creditAccounts && (
        <section className="rounded-2xl border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{t("dues")}</h2>
            <span className="text-sm font-semibold tabular-nums">{formatRupees(dues.reduce((a, d) => a + d.balancePaise, 0))}</span>
          </div>
          {dues.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDues")}</p>
          ) : (
            <ul className="divide-y divide-dashed text-sm tabular-nums">
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

      {features.farmRecords && (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">{t("farmProfit")}</h2>
            <Link href="/farm/records" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t("records")} →
            </Link>
          </div>
          {(() => {
            const p = profit(s.netPaise, spent.totalPaise)
            const cell = (label: string, value: string, strong = false) => (
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className={cn("text-lg font-bold tabular-nums", strong && p.profitPaise < 0 && "text-destructive")}>{value}</div>
              </div>
            )
            return (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {cell(t("netSales"), formatRupees(s.netPaise))}
                  {cell(t("spent"), formatRupees(spent.totalPaise))}
                  {cell(t("profit"), `${p.profitPaise < 0 ? "−" : ""}${formatRupees(Math.abs(p.profitPaise))}${p.marginPct != null ? ` · ${p.marginPct}%` : ""}`, true)}
                  {cell(t("eggsCollected"), prod.daysRecorded ? `${prod.eggsCollected - prod.eggsBroken} · ${t("perDay", { count: prod.eggsPerDay })}` : "—")}
                  {cell(t("layingRate"), prod.layingRatePct != null ? `${prod.layingRatePct}%` : "—")}
                  {cell(t("feedPerEgg"), spent.feedPerEggPaise != null ? formatRupees(spent.feedPerEggPaise) : "—")}
                  {cell(t("costPerEgg"), spent.costPerEggPaise != null ? formatRupees(spent.costPerEggPaise) : "—")}
                  {cell(t("birdsLost"), prod.daysRecorded ? `${prod.birdsLost}${prod.birdsNow != null ? ` · ${t("birdsNow", { count: prod.birdsNow })}` : ""}` : "—")}
                </div>
                {spent.byKind.length > 0 && (
                  <ul className="divide-y text-sm">
                    {spent.byKind.map((k) => (
                      <li key={k.kind} className="flex justify-between py-1.5 tabular-nums">
                        <span>{tr(`kind_${k.kind}`)}</span>
                        <b>{formatRupees(k.paise)}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {prod.daysRecorded === 0 && spendRows.length === 0 && <p className="text-sm text-muted-foreground">{t("noRecords")}</p>}
              </>
            )
          })()}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("downloads")}</h2>
        <p className="text-sm text-muted-foreground">{t("downloadsHint")}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["sales", "payments", "products", ...(features.creditAccounts ? ["dues"] : [])] as const).map((type) => (
            <Button key={type} asChild variant="outline">
              <a href={exportHref(type)}>
                <Download /> {t(`export_${type}`)}
              </a>
            </Button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("allData")}</h2>
        <p className="text-sm text-muted-foreground">{t("allDataHint")}</p>
        <Button asChild variant="outline" className="self-start">
          <a href="/farm/export/all">
            <Download /> {t("allDataButton")}
          </a>
        </Button>
      </section>
    </div>
  )
}
