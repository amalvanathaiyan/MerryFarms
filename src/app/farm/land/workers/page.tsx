import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { landTabs } from "@/lib/farm-sections"
import { dayLabel } from "@/lib/i18n-helpers"
import { addDays, istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { workersOn } from "@/server/workers"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/farm/section-header"
import { AddWorker, AttendanceForm } from "@/components/farm/worker-forms"

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * My farm · Workers, read top to bottom: the day (today, or another with the arrows), who came and where they
 * worked, with one Save; then everyone with what they're owed, each opening their own page to pay them.
 */
export default async function WorkersPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams
  const { db } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.workers")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const today = istDate(new Date())
  const date = sp.date && YMD.test(sp.date) && sp.date <= today ? sp.date : today
  const [workers, places] = await Promise.all([workersOn(db, date), db.farmPlace.findMany({ where: { retiredAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } })])
  // Who could work that day: joined by then and not left before it
  const onDay = workers.filter((w) => (!w.joinedOn || w.joinedOn <= date) && (!w.leftOn || w.leftOn >= date))
  const current = workers.filter((w) => !w.leftOn)
  const gone = workers.filter((w) => w.leftOn)
  const totalOwed = current.reduce((a, w) => a + Math.max(0, w.owedPaise), 0)
  const label = dayLabel(date, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const link = (d: string) => (d === today ? "/farm/land/workers" : `/farm/land/workers?date=${d}`)

  const workerLink = (w: (typeof workers)[number]) => (
    <li key={w.id}>
      <Link href={`/farm/land/workers/${w.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-2 hover:border-primary">
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{w.name}</span>
          <span className="block text-sm text-muted-foreground">{t(w.payType === "monthly" ? "rateMonthLine" : "rateDayLine", { amount: formatRupees(w.ratePaise) })}</span>
        </span>
        <span className={cn("text-right text-sm font-semibold tabular-nums", w.owedPaise > 0 ? "text-foreground" : "text-muted-foreground")}>
          {w.owedPaise > 0 ? t("owesLine", { amount: formatRupees(w.owedPaise) }) : w.owedPaise < 0 ? t("aheadLine", { amount: formatRupees(-w.owedPaise) }) : t("settled")}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" tabs={landTabs()} active="workers" back={{ href: "/farm/more" }} />

      {workers.length === 0 ? (
        <>
          <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("none")}</p>
          <AddWorker today={today} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <Link href={link(addDays(date, -1))} aria-label={t("dayBefore")} className="grid size-11 place-items-center rounded-xl border-2 bg-card hover:bg-accent">
              <ChevronLeft className="size-5" aria-hidden />
            </Link>
            <h2 className="text-center text-lg font-bold">{t("dayTitle", { day: label })}</h2>
            {date < today ? (
              <Link href={link(addDays(date, 1))} aria-label={t("dayAfter")} className="grid size-11 place-items-center rounded-xl border-2 bg-card hover:bg-accent">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            ) : (
              <span className="size-11" />
            )}
          </div>
          {onDay.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-4 text-center text-muted-foreground">{t("noneThatDay")}</p>
          ) : (
            <AttendanceForm key={date} date={date} rows={onDay.map((w) => ({ id: w.id, name: w.name, role: w.role, state: w.state, placeId: w.placeId }))} places={places} />
          )}

          <section className="flex flex-col gap-2 pt-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold">{t("everyone")}</h2>
              {totalOwed > 0 && <span className="text-sm font-semibold tabular-nums">{t("totalOwed", { amount: formatRupees(totalOwed) })}</span>}
            </div>
            <ul className="flex flex-col gap-2">{current.map(workerLink)}</ul>
            <AddWorker today={today} />
            {gone.length > 0 && (
              <details className="rounded-2xl border bg-card">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{t("leftTitle", { count: gone.length })}</summary>
                <ul className="flex flex-col gap-2 p-3">{gone.map(workerLink)}</ul>
              </details>
            )}
          </section>
        </>
      )}
    </div>
  )
}
