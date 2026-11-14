import { getLocale, getTranslations } from "next-intl/server"
import { Wrench } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { landTabs } from "@/lib/farm-sections"
import { dayLabel } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { istDate } from "@/domain/ist"
import { serviceDue } from "@/domain/farm-core"
import { farmCoreSpending } from "@/server/farm-core"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/farm/section-header"
import { AddAsset, AssetActions, type AssetRow } from "@/components/farm/farm-core-forms"

const DUE_STYLE = { overdue: "bg-destructive/10 text-destructive", soon: "bg-yolk text-yolk-foreground", ok: "bg-accent text-accent-foreground" } as const

/**
 * My farm · Assets: motors, pumps, tractors and the rest. Due services come first; each asset shows when its next
 * service is due, what it cost to keep running this year, and its latest repairs. "Repair or service" logs the work
 * and its cost in one go (the cost is spending in Money, on this asset).
 */
export default async function AssetsPage() {
  const { db } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.land")
  const tc = await getTranslations("common")
  const tr = await getTranslations("farm.records")
  const locale = await getLocale()
  const today = istDate(new Date())
  const [assets, places, spend] = await Promise.all([
    db.farmAsset.findMany({ orderBy: { createdAt: "asc" } }),
    db.farmPlace.findMany({ where: { retiredAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
    farmCoreSpending(db, today),
  ])
  const day = (d: string) => dayLabel(d, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const withDue = assets.map((a) => ({ ...a, due: serviceDue(a, today) }))
  const order = { overdue: 0, soon: 1, ok: 2 }
  const live = withDue.filter((a) => !a.retiredAt).sort((a, b) => (a.due ? order[a.due.state] : 3) - (b.due ? order[b.due.state] : 3))
  const retired = withDue.filter((a) => a.retiredAt)
  const row = (a: (typeof assets)[number]): AssetRow => ({ id: a.id, kind: a.kind, name: a.name, placeId: a.placeId, boughtOn: a.boughtOn, costPaise: a.costPaise, serviceEveryDays: a.serviceEveryDays, lastServiceOn: a.lastServiceOn, notes: a.notes })

  const card = (a: (typeof withDue)[number]) => {
    const place = places.find((p) => p.id === a.placeId)
    const spent = spend.byAsset[a.id] ?? 0
    const history = spend.latest[a.id] ?? []
    return (
      <li key={a.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sec-plans-tint text-sec-plans">
            <Wrench className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-lg leading-tight font-bold">{a.name}</div>
            <div className="text-sm text-muted-foreground">{[t(`asset_${a.kind}`), place?.name, a.costPaise ? t("boughtFor", { amount: formatRupees(a.costPaise) }) : null].filter(Boolean).join(" · ")}</div>
            {a.due && !a.retiredAt && (
              <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold", DUE_STYLE[a.due.state])}>
                {a.due.state === "overdue" ? t("serviceOverdue", { day: day(a.due.on) }) : t("serviceDue", { day: day(a.due.on) })}
              </span>
            )}
            {spent > 0 && <div className="mt-1 text-sm font-medium">{t("spentYear", { amount: formatRupees(spent) })}</div>}
            {a.notes && <div className="text-sm whitespace-pre-line">{a.notes}</div>}
          </div>
        </div>
        {history.length > 0 && (
          <details className="rounded-xl bg-muted/50">
            <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm font-semibold">{t("history")}</summary>
            <ul className="divide-y px-3 pb-2 text-sm">
              {history.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    {day(e.date)} · {tr(`kind_${e.kind}`)}
                    {e.note && <span className="text-muted-foreground"> · {e.note}</span>}
                  </span>
                  <b className="tabular-nums">{formatRupees(e.amountPaise)}</b>
                </li>
              ))}
            </ul>
          </details>
        )}
        <AssetActions asset={row(a)} places={places} today={today} retired={!!a.retiredAt} />
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" tabs={landTabs()} active="assets" back={{ href: "/farm/more" }} />
      <AddAsset places={places} today={today} />
      {live.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noAssets")}</p> : <ul className="flex flex-col gap-2">{live.map(card)}</ul>}
      {retired.length > 0 && (
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{t("retiredTitle", { count: retired.length })}</summary>
          <ul className="flex flex-col gap-2 p-3">{retired.map(card)}</ul>
        </details>
      )}
    </div>
  )
}
