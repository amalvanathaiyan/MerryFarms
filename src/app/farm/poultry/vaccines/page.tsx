import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { CalendarClock, CheckCircle2, ChevronRight } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { poultryTabs } from "@/lib/farm-sections"
import { batchStatus, onFarm } from "@/domain/batches"
import { addDays, daysBetween, istDate } from "@/domain/ist"
import { doseState } from "@/domain/vaccinations"
import { asDay, asInfo, asLoss, loadBatches } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { cn } from "@/lib/utils"
import { QuickGiveButton } from "@/components/farm/quick-give-button"

/**
 * Poultry care · Vaccines: what to give now (one tap, or on Entry), what's coming, and every dose given, for all
 * batches or one. The farm's vaccine plan is set from here (owner).
 */
export default async function PoultryVaccinesPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const t = await getTranslations("farm.vaccines")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const isOwner = staff.roles.includes("owner")

  const [{ batches, days, losses }, doses] = await Promise.all([loadBatches(tenant.id), db.batchVaccination.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] })])
  const live = batches.filter((b) => onFarm(b, today))
  const byId = new Map(live.map((b) => [b.id, b]))
  const dayRows = days.map(asDay)
  const lossRows = losses.map(asLoss)
  const alive = new Map(live.map((b) => [b.id, batchStatus(asInfo(b), dayRows, lossRows, today).alive]))
  const mine = doses.filter((d) => byId.has(d.batchId)).map((d) => ({ ...d, state: doseState(d, today), batch: byId.get(d.batchId)! }))

  const giveNow = mine.filter((d) => d.state === "overdue" || d.state === "today")
  const comingUp = mine.filter((d) => (d.state === "soon" || d.state === "later") && d.dueDate! <= addDays(today, 30))
  // Every dose given, on any batch (closed ones too), newest first; for one batch with the filter.
  const allById = new Map(batches.map((b) => [b.id, b]))
  const givenAll = doses.filter((d) => d.givenDate && allById.has(d.batchId)).map((d) => ({ ...d, batch: allById.get(d.batchId)! }))
  const withDoses = batches.filter((b) => givenAll.some((d) => d.batchId === b.id)).sort((a, b) => a.number - b.number)
  const only = withDoses.find((b) => b.id === sp.batch) ?? null
  const given = givenAll.filter((d) => !only || d.batchId === only.id).sort((a, b) => b.givenDate!.localeCompare(a.givenDate!))
  const batchName = (b: { name: string; number: number }) => `${b.name} · #${b.number}`

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" tabs={poultryTabs({ roles: staff.roles, features: featuresOf(tenant) })} active="vaccines" />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-destructive">{t("giveNow")}</h2>
        {giveNow.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("nothingDue")}</p>}
        {giveNow.map((d) => {
          const late = daysBetween(d.dueDate!, today)
          return (
            <div key={d.id} className="flex flex-col gap-2.5 rounded-2xl border-2 border-destructive/25 bg-destructive/10 p-4">
              <Link href={`/farm/poultry/entry?batch=${d.batchId}`} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-lg leading-tight font-bold">
                    {d.vaccine}
                    {d.method && <span className="font-normal"> · {t(`method_${d.method}`)}</span>}
                  </div>
                  <div className="text-sm">
                    {batchName(d.batch)} · {late > 0 ? t("lateDays", { day: dayLabel(d.dueDate!, locale, labels), count: late }) : t("dueToday")}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
              <QuickGiveButton doseId={d.id} vaccine={d.vaccine} today={today} birds={alive.get(d.batchId) ?? 0} />
            </div>
          )
        })}
      </section>

      {comingUp.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-muted-foreground">{t("comingUp")}</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {comingUp.map((d) => (
              <li key={d.id}>
                <Link href={`/farm/poultry/batches/${d.batchId}#vaccinations`} className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <span className="block font-bold">
                      {d.vaccine}
                      {d.method && <span className="font-normal"> · {t(`method_${d.method}`)}</span>}
                    </span>
                    <span className="block text-sm text-muted-foreground">{batchName(d.batch)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-bold">{dayLabel(d.dueDate!, locale, labels)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {givenAll.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-muted-foreground">{t("givenAll")}</h2>
          {withDoses.length > 1 && (
            <nav aria-label={t("filterBatch")} className="flex flex-wrap gap-2">
              {[{ id: null as string | null, label: t("allBatches") }, ...withDoses.map((b) => ({ id: b.id, label: batchName(b) }))].map((c) => (
                <Link
                  key={c.id ?? "all"}
                  href={c.id ? `/farm/poultry/vaccines?batch=${c.id}` : "/farm/poultry/vaccines"}
                  aria-current={(only?.id ?? null) === c.id ? "page" : undefined}
                  className={cn("flex min-h-11 items-center rounded-xl border-2 px-3 text-sm", (only?.id ?? null) === c.id ? "border-sec-poultry bg-sec-poultry-tint font-bold" : "bg-card font-semibold hover:bg-accent")}
                >
                  {c.label}
                </Link>
              ))}
            </nav>
          )}
          <ul className="divide-y rounded-2xl border bg-card">
            {given.map((d) => (
              <li key={d.id}>
                <Link href={`/farm/poultry/batches/${d.batchId}#vaccinations`} className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {d.vaccine}
                      {d.birds != null && <span className="font-normal text-muted-foreground"> · {t("birdsGiven", { count: d.birds })}</span>}
                    </span>
                    <span className="block text-sm text-muted-foreground">{batchName(d.batch)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                    <CheckCircle2 className="size-4" aria-hidden /> {dayLabel(d.givenDate!, locale, labels)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isOwner && (
        <Link href="/farm/poultry/vaccines/plan" className="flex h-13 items-center justify-center gap-2 rounded-2xl border-2 bg-card text-base font-bold hover:bg-accent">
          <CalendarClock className="size-5" aria-hidden /> {t("farmPlan")}
        </Link>
      )}
      <Link href="/farm/poultry/entry" className="text-center text-sm font-semibold text-primary underline-offset-4 hover:underline">
        {t("addOnEntry")}
      </Link>
    </div>
  )
}
