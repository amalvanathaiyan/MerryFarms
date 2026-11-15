import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronLeft, ChevronRight, Phone } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { dayLabel } from "@/lib/i18n-helpers"
import { addMonths, istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { formatIndianMobile } from "@/domain/phone"
import { workerMonth } from "@/server/workers"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/farm/section-header"
import { Button } from "@/components/ui/button"
import { PayForm, RemovePayment, WorkerActions } from "@/components/farm/worker-forms"

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const STATE_STYLE: Record<string, string> = { present: "bg-primary text-primary-foreground", half: "bg-yolk text-yolk-foreground", absent: "bg-muted text-muted-foreground" }

/**
 * One worker, read top to bottom: what they're owed and paying them; their month (days worked and earned, each day
 * marked); the money given to them; their details. Months move with the arrows.
 */
export default async function WorkerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ month?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const { db } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.workers")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const today = istDate(new Date())
  const thisMonth = today.slice(0, 7)
  const month = sp.month && MONTH.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth
  const m = await workerMonth(db, id, month)
  if (!m) notFound()
  const w = m.worker
  const day = (d: string) => dayLabel(d, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const monthName = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))
  const link = (mo: string) => (mo === thisMonth ? `/farm/land/workers/${id}` : `/farm/land/workers/${id}?month=${mo}`)
  const prev = addMonths(`${month}-01`, -1).slice(0, 7)
  const next = addMonths(`${month}-01`, 1).slice(0, 7)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" title={w.name} hint={[w.role, t(w.payType === "monthly" ? "rateMonthLine" : "rateDayLine", { amount: formatRupees(w.ratePaise) })].filter(Boolean).join(" · ")} back={{ href: "/farm/land/workers", label: t("back") }} />

      <p className={cn("rounded-2xl px-4 py-3 text-lg font-bold", m.owedPaise > 0 ? "bg-yolk text-yolk-foreground" : "bg-accent")}>
        {m.owedPaise > 0 ? t("owesLine", { amount: formatRupees(m.owedPaise) }) : m.owedPaise < 0 ? t("aheadLine", { amount: formatRupees(-m.owedPaise) }) : t("settled")}
      </p>
      {w.phone && (
        <Button asChild variant="outline" size="lg" className="h-12 self-start">
          <a href={`tel:${w.phone}`}>
            <Phone aria-hidden /> <span className="tabular-nums">{formatIndianMobile(w.phone)}</span>
          </a>
        </Button>
      )}
      {!w.leftOn && <PayForm workerId={w.id} owedPaise={Math.max(0, m.owedPaise)} today={today} />}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <Link href={link(prev)} aria-label={t("monthBefore")} className="grid size-10 place-items-center rounded-xl border-2 hover:bg-accent">
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h2 className="text-center font-bold">{monthName}</h2>
          {month < thisMonth ? (
            <Link href={link(next)} aria-label={t("monthAfter")} className="grid size-10 place-items-center rounded-xl border-2 hover:bg-accent">
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          ) : (
            <span className="size-10" />
          )}
        </div>
        <p className="font-semibold">{t("monthLine", { days: m.month.days, amount: formatRupees(m.month.paise) })}</p>
        {m.monthDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noDays")}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {m.monthDays.map((d) => (
              <li key={d.id} className={cn("rounded-lg px-2 py-1 text-sm font-semibold tabular-nums", STATE_STYLE[d.state])} title={t(`state_${d.state}`)}>
                {Number(d.date.slice(8))}
                <span className="sr-only"> {t(`state_${d.state}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("given")}</h2>
        {m.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
        ) : (
          <ul className="divide-y">
            {m.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{t(`kind_${p.kind}`)}</span> <span className="text-muted-foreground">· {day(p.date)}</span>
                  {p.note && <span className="block truncate text-sm text-muted-foreground">{p.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <b className="tabular-nums">{formatRupees(p.amountPaise)}</b>
                  <RemovePayment id={p.id} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("details")}</h2>
        <p className="text-sm text-muted-foreground">
          {[w.joinedOn && t("joinedLine", { day: day(w.joinedOn) }), w.leftOn && t("leftLine", { day: day(w.leftOn) })].filter(Boolean).join(" · ")}
        </p>
        {w.notes && <p className="text-sm whitespace-pre-line">{w.notes}</p>}
        <WorkerActions worker={{ id: w.id, name: w.name, phone: w.phone, role: w.role, payType: w.payType, ratePaise: w.ratePaise, joinedOn: w.joinedOn, notes: w.notes }} left={!!w.leftOn} today={today} />
      </section>
    </div>
  )
}
