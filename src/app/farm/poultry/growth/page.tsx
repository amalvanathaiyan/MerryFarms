import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { poultryTabs } from "@/lib/farm-sections"
import { onFarm } from "@/domain/batches"
import { istDate } from "@/domain/ist"
import { weighDue, weightPoints } from "@/domain/weights"
import { asInfo, loadBatches } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { BatchWeights, type WeightItem } from "@/components/farm/batch-weights"
import { WeighForm } from "@/components/farm/weigh-form"

/**
 * Poultry care · Growth: weigh birds (any day; the form opens by itself when a weighing is due), and every batch's
 * weighings and growth line. Weighing is weekly, so it lives here rather than on the daily Entry page.
 */
export default async function PoultryGrowthPage({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const t = await getTranslations("farm.growth")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())

  const [{ batches }, weighings] = await Promise.all([loadBatches(tenant.id), db.batchWeight.findMany({ orderBy: { date: "asc" } })])
  const live = batches.filter((b) => onFarm(b, today)).sort((a, b) => a.number - b.number)
  // Batches that left the farm, with weighings: kept behind one link so the page stays about today's birds.
  const closed = batches.filter((b) => !onFarm(b, today) && weighings.some((w) => w.batchId === b.id))
  const showClosed = sp.closed === "1"

  const block = (b: (typeof batches)[number]) => {
    const rows = weighings.filter((w) => w.batchId === b.id)
    const due = weighDue(b, rows, today)
    const items: WeightItem[] = weightPoints(asInfo(b), rows).map((p, i) => ({ ...p, id: rows[i].id, dayText: dayLabel(p.date, locale, labels) }))
    return (
      <div key={b.id} id={`b-${b.id}`} className="flex scroll-mt-32 flex-col gap-1">
        <Link href={`/farm/poultry/batches/${b.id}`} className="self-start text-lg font-bold underline-offset-4 hover:underline">
          {b.name} <span className="font-normal text-muted-foreground">· #{b.number}</span>
        </Link>
        <BatchWeights weights={items} due={due}>
          {onFarm(b, today) && <WeighForm batchId={b.id} batchName={b.name} minDate={b.startDate} maxDate={today} lastBirds={rows.at(-1)?.birds ?? null} due={due.due} />}
        </BatchWeights>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" tabs={poultryTabs({ roles: staff.roles, features: featuresOf(tenant) })} active="growth" />
      {live.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("none")}</p>}
      {live.map(block)}
      {closed.length > 0 &&
        (showClosed ? (
          <>
            <h2 className="text-lg font-bold text-muted-foreground">{t("closedTitle")}</h2>
            {closed.map(block)}
          </>
        ) : (
          <Link href="/farm/poultry/growth?closed=1" className="self-center text-sm font-semibold text-primary underline underline-offset-4">
            {t("showClosed", { count: closed.length })}
          </Link>
        ))}
    </div>
  )
}
