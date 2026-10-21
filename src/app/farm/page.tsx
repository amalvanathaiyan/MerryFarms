import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { istDate, istInstant } from "@/domain/ist"
import { cn } from "@/lib/utils"
import { allBalances } from "@/server/billing"

export default async function TodayPage() {
  const { db, tenant } = await requireStaff()
  const locale = await getLocale()
  const t = await getTranslations("farm.today")
  const tc = await getTranslations("common")
  const tu = await getTranslations("farm.units")
  const unitName = (u: string) => (tu.has(u) ? tu(u) : u)
  const today = istDate(new Date())

  const [toConfirm, open, todays, balances, toPack, lowStock] = await Promise.all([
    db.order.count({ where: { status: "to_confirm" } }),
    db.order.count({ where: { status: { in: ["to_confirm", "confirmed", "packed", "out_for_delivery"] } } }),
    db.order.aggregate({
      where: { status: { not: "cancelled" }, createdAt: { gte: istInstant(today, "00:00") } },
      _sum: { totalPaise: true },
    }),
    allBalances(tenant.id),
    db.order.findMany({
      where: { status: { in: ["to_confirm", "confirmed"] } },
      include: { items: { include: { product: true } }, address: true, slot: true },
      orderBy: [{ slotDate: "asc" }, { slotLabel: "asc" }],
    }),
    db.product.findMany({ where: { isActive: true, deletedAt: null, stockQty: { lte: 5 } }, orderBy: { stockQty: "asc" } }),
  ])

  // Packing list: total quantity per product across orders still to pack.
  const packing = new Map<string, { name: string; pack: string; unit: string; qty: number }>()
  for (const o of toPack) {
    for (const i of o.items) {
      const row = packing.get(i.productId) ?? {
        name: pick(locale, i.product.nameTa, i.product.nameEn),
        pack: pick(locale, i.product.packTa, i.product.packEn),
        unit: i.product.stockUnit,
        qty: 0,
      }
      row.qty += i.qty
      packing.set(i.productId, row)
    }
  }

  // Delivery runs: orders grouped by date and slot, with the streets to visit.
  const runs = new Map<string, { label: string; stops: string[] }>()
  for (const o of toPack) {
    const key = `${o.slotDate}|${o.slotLabel}`
    const run = runs.get(key) ?? { label: `${dayLabel(o.slotDate, locale, { today: tc("today"), tomorrow: tc("tomorrow") })} · ${o.slotLabel}`, stops: [] }
    run.stops.push(o.address?.landmark || o.address?.line.split(",").pop()?.trim() || "—")
    runs.set(key, run)
  }

  const tiles = [
    { label: t("toConfirm"), value: String(toConfirm), href: "/farm/orders", hot: toConfirm > 0 },
    { label: t("open"), value: String(open), href: "/farm/orders?tab=open" },
    { label: t("sales"), value: formatRupees(todays._sum.totalPaise ?? 0) },
    { label: t("dues"), value: formatRupees([...balances.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0)), href: "/farm/customers?dues=1" },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const body = (
            <>
              <div className="text-sm font-medium">{tile.label}</div>
              <div className="text-3xl font-bold tabular-nums">{tile.value}</div>
            </>
          )
          const cls = cn("rounded-2xl border p-4", tile.hot ? "border-transparent bg-yolk text-yolk-foreground" : "bg-card")
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className={cls}>
              {body}
            </Link>
          ) : (
            <div key={tile.label} className={cls}>
              {body}
            </div>
          )
        })}
      </div>

      {lowStock.map((p) => (
        <p key={p.id} className="rounded-xl bg-destructive/10 px-4 py-3 font-medium text-destructive">
          {t("lowStock", { name: `${pick(locale, p.nameTa, p.nameEn)} (${pick(locale, p.packTa, p.packEn)})`, count: p.stockQty, unit: unitName(p.stockUnit) })}
        </p>
      ))}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("packing")}</h2>
        {packing.size === 0 ? (
          <p className="text-muted-foreground">{t("nothingToPack")}</p>
        ) : (
          <ul className="divide-y divide-dashed">
            {[...packing.values()].map((r) => (
              <li key={`${r.name}${r.pack}`} className="flex justify-between gap-3 py-2">
                <span>
                  {r.name} <span className="text-muted-foreground">· {r.pack}</span>
                </span>
                <b className="tabular-nums">{r.qty}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("runs")}</h2>
        {runs.size === 0 ? (
          <p className="text-muted-foreground">{t("noRuns")}</p>
        ) : (
          <ul className="divide-y divide-dashed">
            {[...runs.entries()].map(([key, r]) => (
              <li key={key} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  {r.label}
                  <span className="block text-sm text-muted-foreground">{r.stops.join(", ")}</span>
                </span>
                <b className="shrink-0">{t("stops", { count: r.stops.length })}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
