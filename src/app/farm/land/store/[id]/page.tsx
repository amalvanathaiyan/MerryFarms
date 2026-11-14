import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { dayLabel } from "@/lib/i18n-helpers"
import { istDate } from "@/domain/ist"
import { isLow } from "@/domain/inputs"
import { formatRupees } from "@/domain/money"
import { inputDetail } from "@/server/inputs"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/farm/section-header"
import { InputActions, RemoveUse, StoreMoves } from "@/components/farm/store-forms"

/**
 * One item in the store, read top to bottom: what's left (and for the hens' feed, what batches were given); buying,
 * using or counting it; what came in and went out; its details.
 */
export default async function StoreItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, tenant } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.store")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const today = istDate(new Date())
  const poultry = featuresOf(tenant).poultryCare
  const [d, places] = await Promise.all([inputDetail(db, id, today), db.farmPlace.findMany({ where: { retiredAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } })])
  if (!d) notFound()
  const { item, stock } = d
  const unit = t(`unit_${item.unit}`)
  const qty = (n: number) => t("qtyValue", { qty: Math.round(n * 100) / 100, unit })
  const day = (s: string) => dayLabel(s, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const low = isLow(stock.left, item.lowAt)
  const placeName = (pid: string | null) => (pid ? (places.find((p) => p.id === pid)?.name ?? null) : null)

  // In and out together, latest first
  const moves = [
    ...d.buys.map((b) => ({ key: `b${b.id}`, date: b.date, text: t("boughtLine", { qty: qty(b.quantity ?? 0) }), sub: b.note, amount: formatRupees(b.amountPaise), useId: null as string | null })),
    ...d.uses.map((u) => ({
      key: `u${u.id}`,
      date: u.date,
      text: u.kind === "count" ? t(u.quantity >= 0 ? "countUpLine" : "countDownLine", { qty: qty(Math.abs(u.quantity)) }) : t("usedLine", { qty: qty(u.quantity) }),
      sub: [placeName(u.placeId), u.note].filter(Boolean).join(" · ") || null,
      amount: null,
      useId: u.id,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" title={item.name} hint={[t(`kind_${item.kind}`), item.batchFeed && t("batchFeedShort")].filter(Boolean).join(" · ")} back={{ href: "/farm/land/store", label: t("back") }} />

      <section className={cn("flex flex-col gap-1 rounded-2xl px-4 py-3", low ? "bg-yolk text-yolk-foreground" : "bg-accent")}>
        <p className={cn("font-display text-4xl leading-none font-bold tabular-nums", stock.left < 0 && "text-destructive")}>{t("leftValue", { qty: stock.left, unit })}</p>
        {low && <p className="font-semibold">{t("lowLine", { qty: qty(item.lowAt!) })}</p>}
        <p className="text-sm">{[t("boughtTotal", { qty: qty(stock.bought) }), t("usedTotal", { qty: qty(stock.used) }), stock.pricePaise != null && t("priceLine", { amount: formatRupees(stock.pricePaise), unit: t(`unitOne_${item.unit}`) })].filter(Boolean).join(" · ")}</p>
        {stock.left < 0 && <p className="text-sm">{t("negative")}</p>}
      </section>
      {item.batchFeed && poultry && (
        <p className="text-sm text-muted-foreground">
          {t("batchFeedNote")}{" "}
          <Link href="/farm/poultry/feed" className="font-semibold text-primary underline underline-offset-4">
            {t("batchFeedLink")}
          </Link>
        </p>
      )}

      {!item.retiredAt && <StoreMoves item={{ id: item.id, unit: item.unit }} left={stock.left} places={places} today={today} />}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("historyTitle")}</h2>
        {moves.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <ul className="divide-y">
            {moves.map((m) => (
              <li key={m.key} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{m.text}</span> <span className="text-muted-foreground">· {day(m.date)}</span>
                  {m.sub && <span className="block truncate text-sm text-muted-foreground">{m.sub}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {m.amount && <b className="tabular-nums">{m.amount}</b>}
                  {m.useId && <RemoveUse id={m.useId} />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {d.buys.length > 0 && <p className="text-xs text-muted-foreground">{t("buyRemoveHint")}</p>}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("details")}</h2>
        <p className="text-sm text-muted-foreground">{[t("unitLine", { unit }), item.lowAt != null ? t("lowAtLine", { qty: qty(item.lowAt) }) : t("noLowAt")].join(" · ")}</p>
        <InputActions item={{ id: item.id, name: item.name, kind: item.kind, unit: item.unit, lowAt: item.lowAt, batchFeed: item.batchFeed }} poultry={poultry} retired={!!item.retiredAt} />
      </section>
    </div>
  )
}
