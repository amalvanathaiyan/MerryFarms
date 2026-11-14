import { getTranslations } from "next-intl/server"
import { Droplets, Fish, Home, LandPlot, Map, Package, Warehouse, type LucideIcon } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { landTabs } from "@/lib/farm-sections"
import { formatRupees } from "@/domain/money"
import { isOneOf, LAND_KINDS, totalLandAcres } from "@/domain/farm-core"
import { farmCoreSpending } from "@/server/farm-core"
import { SectionHeader } from "@/components/farm/section-header"
import { AddPlace, PlaceActions, type PlaceRow } from "@/components/farm/farm-core-forms"

const ICONS: Record<string, LucideIcon> = { block: Map, plot: LandPlot, shed: Warehouse, pond: Fish, well: Droplets, borewell: Droplets, store: Package, other: Home }

/**
 * My farm · Places: the farm's land (blocks, and plots inside them), sheds, ponds, wells and borewells, stores.
 * One line of land in total at the top; each place shows its details and what was spent on it in the last year.
 * Places no longer used are folded at the end.
 */
export default async function PlacesPage() {
  const { db } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.land")
  const [places, spend] = await Promise.all([db.farmPlace.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }), farmCoreSpending(db)])
  const live = places.filter((p) => !p.retiredAt)
  const retired = places.filter((p) => p.retiredAt)
  const blocks = live.filter((p) => p.kind === "block").map(({ id, name }) => ({ id, name }))
  const acres = totalLandAcres(places)
  const row = (p: (typeof places)[number]): PlaceRow => ({ id: p.id, kind: p.kind, name: p.name, parentId: p.parentId, area: p.area, areaUnit: p.areaUnit, surveyNo: p.surveyNo, soil: p.soil, depthFt: p.depthFt, notes: p.notes })
  // Blocks with their plots under them, then everything else in the order added
  const top = live.filter((p) => !(p.kind === "plot" && p.parentId && live.some((b) => b.id === p.parentId)))
  const plotsOf = (id: string) => live.filter((p) => p.parentId === id)

  const card = (p: (typeof places)[number], nested = false) => {
    const Icon = ICONS[p.kind] ?? Home
    const facts = [
      t(`place_${p.kind}`),
      p.area ? `${p.area} ${t(`unit_${p.areaUnit}`)}` : null,
      p.depthFt ? t("depthLine", { ft: p.depthFt }) : null,
      p.soil ? t(`soil_${p.soil}`) : null,
      p.surveyNo ? t("surveyLine", { no: p.surveyNo }) : null,
    ].filter(Boolean)
    const spent = spend.byPlace[p.id] ?? 0
    return (
      <li key={p.id} className={nested ? "ml-5 border-l-4 border-sec-plans/40 pl-3" : undefined}>
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sec-plans-tint text-sec-plans">
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-lg leading-tight font-bold">{p.name}</div>
              <div className="text-sm text-muted-foreground">{facts.join(" · ")}</div>
              {spent > 0 && <div className="text-sm font-medium">{t("spentYear", { amount: formatRupees(spent) })}</div>}
              {p.notes && <div className="text-sm whitespace-pre-line">{p.notes}</div>}
            </div>
          </div>
          <PlaceActions place={row(p)} blocks={blocks} retired={!!p.retiredAt} />
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" tabs={landTabs()} active="places" back={{ href: "/farm/more" }} />
      {live.length > 0 && (
        <p className="rounded-2xl bg-sec-plans-tint px-4 py-3 font-semibold">
          {acres > 0 ? t("landTotal", { acres, count: live.length }) : t("placesTotal", { count: live.length })}
        </p>
      )}
      <AddPlace blocks={blocks} />
      {live.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noPlaces")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {top.flatMap((p) => [card(p), ...(p.kind === "block" ? plotsOf(p.id).map((c) => card(c, true)) : [])])}
        </ul>
      )}
      {retired.length > 0 && (
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{t("retiredTitle", { count: retired.length })}</summary>
          <ul className="flex flex-col gap-2 p-3">{retired.map((p) => card(p))}</ul>
        </details>
      )}
      {live.some((p) => isOneOf(LAND_KINDS, p.kind)) && <p className="text-sm text-muted-foreground">{t("spendHint")}</p>}
    </div>
  )
}
