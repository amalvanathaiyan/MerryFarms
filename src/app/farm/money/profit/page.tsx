import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { moneyTabs } from "@/lib/farm-sections"
import { pick } from "@/lib/i18n-helpers"
import { tenantDb } from "@/lib/tenant-db"
import { formatRupees } from "@/domain/money"
import { costs, production, productionTotals, profit } from "@/domain/records"
import { flockDays, lossesValued } from "@/domain/batches"
import { loadReport } from "@/server/reports"
import { batchBook } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { pickRange, RangePicker } from "@/components/farm/range-picker"
import { cn } from "@/lib/utils"

const signed = (p: number) => `${p < 0 ? "−" : ""}${formatRupees(Math.abs(p))}`

/** Money · Profit (owner): sales minus everything the farm spent, where the money went, and what was lost. */
export default async function MoneyProfitPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "farmRecords")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.reports")
  const tp = await getTranslations("farm.moneyProfit")
  const tr = await getTranslations("farm.records")
  const tu = await getTranslations("farm.units")
  const tb = await getTranslations("farm.batches")
  const { key, range } = pickRange(sp, new Date(), "month")

  const db = tenantDb(tenant.id)
  const inRange = { date: { gte: range.from, lte: range.to } }
  const [report, book, spendRows, entries] = await Promise.all([
    loadReport(tenant.id, range.from, range.to),
    features.poultryCare ? batchBook(tenant.id, range.to) : Promise.resolve(null),
    db.expense.findMany({ where: inRange }),
    db.productionEntry.findMany({ where: inRange }),
  ])
  const made = productionTotals(entries)
  const madeProducts = made.length ? await db.product.findMany({ where: { id: { in: made.map((m) => m.productId) } } }) : []
  const prod = production(book ? flockDays(book.rows.map((r) => r.info), book.days, book.losses, range.from, range.to) : [])
  const spent = costs(spendRows, prod)
  const s = report.summary
  const p = profit(s.netPaise, spent.totalPaise)

  const birds = book ? lossesValued(book.losses.filter((l) => l.date >= range.from && l.date <= range.to), new Map(book.rows.map((r) => [r.batch.id, r.money.costPerBirdPaise]))) : []
  const birdsLost = birds.reduce((a, l) => a + l.count, 0)
  const birdsLostPaise = birds.reduce((a, l) => a + l.valuePaise, 0)
  const brokenDays = (book?.days ?? []).filter((d) => d.date >= range.from && d.date <= range.to)
  const eggsBroken = brokenDays.reduce((a, d) => a + (d.eggsBroken ?? 0), 0)
  const eggsBrokenPaise = brokenDays.reduce((a, d) => a + (d.eggsBroken ?? 0) * (book?.rows.find((r) => r.batch.id === d.batchId)?.batch.eggValuePaise ?? 0), 0)
  const spoiled = made.filter((m) => m.wasted > 0)
  const anyLoss = birdsLost > 0 || eggsBroken > 0 || spoiled.length > 0 || s.returnsPaise > 0
  const maxKind = Math.max(1, ...spent.byKind.map((k) => k.paise))
  const unitOf = (id: string) => {
    const pr = madeProducts.find((x) => x.id === id)
    return pr ? (tu.has(pr.stockUnit) ? tu(pr.stockUnit) : pr.stockUnit) : ""
  }
  const nameOf = (id: string) => {
    const pr = madeProducts.find((x) => x.id === id)
    return pr ? `${pick(locale, pr.nameTa, pr.nameEn)} · ${pick(locale, pr.packTa, pr.packEn)}` : "—"
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="money" tabs={moneyTabs({ roles: staff.roles, features })} active="profit" />
      <RangePicker basePath="/farm/money/profit" current={key} range={range} />

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3 text-lg">
          <span className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-accent font-bold text-primary" aria-hidden>
              +
            </span>
            {tp("sales")}
          </span>
          <b className="tabular-nums">{formatRupees(s.netPaise)}</b>
        </div>
        <div className="flex items-center justify-between gap-3 text-lg">
          <span className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-destructive/10 font-bold text-destructive" aria-hidden>
              −
            </span>
            {tp("spent")}
          </span>
          <b className="tabular-nums">{formatRupees(spent.totalPaise)}</b>
        </div>
        <div className={cn("mt-1 flex items-center justify-between gap-3 rounded-xl px-3 py-3", p.profitPaise < 0 ? "bg-destructive/10 text-destructive" : "bg-accent text-primary")}>
          <span className="text-xl font-bold">{tp("profit")}</span>
          <span className="font-display text-3xl font-bold tabular-nums">
            {signed(p.profitPaise)}
            {p.marginPct != null && <span className="text-base font-semibold"> · {p.marginPct}%</span>}
          </span>
        </div>
      </section>

      {spent.byKind.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-bold">{tp("whereWent")}</h2>
          {spent.byKind.map((k) => (
            <div key={k.kind} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3 tabular-nums">
                <span>{tr(`kind_${k.kind}`)}</span>
                <b>{formatRupees(k.paise)}</b>
              </div>
              <div className="h-2.5 rounded-full bg-muted">
                <div className="h-full min-w-1.5 rounded-full bg-sec-money" style={{ width: `${(k.paise / maxKind) * 100}%` }} />
              </div>
            </div>
          ))}
          <Link href="/farm/money/spending" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {tp("seeSpending")} →
          </Link>
        </section>
      )}

      {made.length > 0 && (
        <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
          <h2 className="mb-1 text-lg font-bold">{t("madeTitle")}</h2>
          <ul className="divide-y">
            {made.map((m) => (
              <li key={m.productId} className="flex justify-between gap-3 py-2 tabular-nums">
                <span className="min-w-0 truncate">{nameOf(m.productId)}</span>
                <b className="shrink-0">
                  {m.made} {unitOf(m.productId)}
                </b>
              </li>
            ))}
          </ul>
        </section>
      )}

      {prod.eggsCollected > 0 && (
        <section className="grid grid-cols-2 gap-2">
          {[
            [t("eggsCollected"), `${prod.eggsCollected - prod.eggsBroken} · ${t("perDay", { count: prod.eggsPerDay })}`],
            [t("layingRate"), prod.layingRatePct != null ? `${prod.layingRatePct}%` : "—"],
            [t("feedPerEgg"), spent.feedPerEggPaise != null ? formatRupees(spent.feedPerEggPaise) : "—"],
            [t("costPerEgg"), spent.costPerEggPaise != null ? formatRupees(spent.costPerEggPaise) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-card p-3">
              <div className="text-sm text-muted-foreground">{label}</div>
              <div className="text-xl font-bold tabular-nums">{value}</div>
            </div>
          ))}
        </section>
      )}

      {anyLoss && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">{t("lossesTitle")}</h2>
            <b className="text-destructive tabular-nums">{formatRupees(birdsLostPaise + eggsBrokenPaise + s.returnsPaise)}</b>
          </div>
          <ul className="divide-y tabular-nums">
            {birdsLost > 0 && (
              <li className="flex justify-between gap-3 py-2">
                <Link href="/farm/poultry/profit" className="underline-offset-4 hover:underline">
                  {tp("birdsLost", { count: birdsLost })}
                </Link>
                <b>{formatRupees(birdsLostPaise)}</b>
              </li>
            )}
            {eggsBroken > 0 && (
              <li className="flex justify-between gap-3 py-2">
                <span>
                  {t("eggsBrokenLine")} · {eggsBroken}
                </span>
                <b>{eggsBrokenPaise > 0 ? formatRupees(eggsBrokenPaise) : "—"}</b>
              </li>
            )}
            {spoiled.map((m) => (
              <li key={m.productId} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{t("spoiledLine", { product: nameOf(m.productId) })}</span>
                <span className="shrink-0">
                  {m.wasted} {unitOf(m.productId)}
                </span>
              </li>
            ))}
            {s.returnsPaise > 0 && (
              <li className="flex justify-between gap-3 py-2">
                <span>{t("returns")}</span>
                <b>{formatRupees(s.returnsPaise)}</b>
              </li>
            )}
          </ul>
          {birds.length > 0 && <p className="text-sm text-muted-foreground">{birds.map((b) => `${tb(`cause_${b.cause}`)} ${b.count}`).join(" · ")}</p>}
        </section>
      )}

      {spendRows.length === 0 && made.length === 0 && s.netPaise === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("noRecords")}</p>}
    </div>
  )
}
