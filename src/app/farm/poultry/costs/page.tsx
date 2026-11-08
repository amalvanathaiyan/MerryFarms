import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { featuresOf } from "@/lib/features"
import { poultryTabs } from "@/lib/farm-sections"
import { lossesValued } from "@/domain/batches"
import { formatRupees } from "@/domain/money"
import { batchBook } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { pickRange, RangePicker } from "@/components/farm/range-picker"

/**
 * Poultry care · Costs (owner): what each batch has cost so far (chicks, the feed it ate, medicine and vaccines),
 * per bird and per egg, and birds lost in the period, in ₹. No profit per batch: eggs share one store and birds
 * are sold through orders, so the farm's real profit is under Money → Profit.
 */
export default async function PoultryCostsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "poultryCare")
  const t = await getTranslations("farm.poultryCosts")
  const tb = await getTranslations("farm.batches")
  const { key, range } = pickRange(sp, new Date(), "month")

  const book = await batchBook(tenant.id, range.to)
  const rows = book.rows.filter((r) => r.batch.startDate <= range.to && (!r.batch.closedDate || r.batch.closedDate >= range.from))
  const losses = lossesValued(
    book.losses.filter((l) => l.date >= range.from && l.date <= range.to),
    new Map(book.rows.map((r) => [r.batch.id, r.money.costPerBirdPaise]))
  )
  const lostCount = losses.reduce((a, l) => a + l.count, 0)
  const lostPaise = losses.reduce((a, l) => a + l.valuePaise, 0)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" tabs={poultryTabs({ roles: staff.roles, features: featuresOf(tenant) })} active="costs" />
      <RangePicker basePath="/farm/poultry/costs" current={key} range={range} />

      {rows.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("none")}</p>}
      {rows.map(({ batch, status, money }) => {
        const goodEggs = status.eggsCollected - status.eggsBroken
        const perBirdNow = status.alive > 0 && money.costPaise > 0 ? Math.round(money.costPaise / status.alive) : null
        return (
          <section key={batch.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <Link href={`/farm/poultry/batches/${batch.id}`} className="text-lg font-bold underline-offset-4 hover:underline">
              {batch.name} · {tb("batchNo", { number: batch.number })}
            </Link>
            <dl className="flex flex-col gap-1.5 text-base">
              <div className="flex justify-between gap-3">
                <dt>{batch.source === "eggs_bought" ? t("eggsBought") : t("chicks")}</dt>
                <dd className="tabular-nums">{formatRupees(money.chicksPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("feed", { kg: status.feedKg })}</dt>
                <dd className="tabular-nums">{money.feedPaise == null ? t("feedUnknown") : formatRupees(money.feedPaise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("medicine")}</dt>
                <dd className="tabular-nums">{formatRupees(money.otherPaise)}</dd>
              </div>
            </dl>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-sec-poultry-tint px-3 py-2.5">
              <span className="text-lg font-bold">{t("spent")}</span>
              <span className="font-display text-2xl font-bold tabular-nums">{formatRupees(money.costPaise)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/60 p-2.5">
                <div className="text-sm text-muted-foreground">{t("perBird")}</div>
                <div className="text-xl font-bold tabular-nums">{perBirdNow != null ? formatRupees(perBirdNow) : "—"}</div>
                <div className="text-xs text-muted-foreground">{t("perBirdHint", { count: status.alive })}</div>
              </div>
              <div className="rounded-xl bg-muted/60 p-2.5">
                <div className="text-sm text-muted-foreground">{goodEggs > 0 ? t("perEgg") : t("lost")}</div>
                <div className="text-xl font-bold tabular-nums">
                  {goodEggs > 0 ? (money.costPerEggPaise != null ? formatRupees(money.costPerEggPaise) : "—") : `${status.lost} · ${formatRupees(money.lostValuePaise)}`}
                </div>
                <div className="text-xs text-muted-foreground">{goodEggs > 0 ? t("perEggHint", { count: goodEggs }) : t("lostHintShort")}</div>
              </div>
            </div>
          </section>
        )
      })}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">{t("lostTitle")}</h2>
          {lostCount > 0 && (
            <b className="text-destructive tabular-nums">
              {lostCount} · {formatRupees(lostPaise)}
            </b>
          )}
        </div>
        {losses.length === 0 ? (
          <p className="text-muted-foreground">{t("noLosses")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {losses.map((l) => (
              <li key={l.cause} className="flex justify-between gap-3 tabular-nums">
                <span>{tb(`cause_${l.cause}`)}</span>
                <span>
                  {l.count} · {formatRupees(l.valuePaise)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">{t("lostHint")}</p>
      </section>

      <Link href="/farm/money/profit" className="rounded-2xl bg-sec-money-tint p-4 text-sm font-semibold">
        {t("profitIsFarms")} →
      </Link>
    </div>
  )
}
