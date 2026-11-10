import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { daysBetween, istDate } from "@/domain/ist"
import { batchStatus, hatchDate, hatchRatePct } from "@/domain/batches"
import { batchBook } from "@/server/batches"
import { loadSchedule } from "@/server/vaccinations"
import { doseState, planFor } from "@/domain/vaccinations"
import { BatchVaccinations, type DoseRow } from "@/components/farm/batch-vaccinations"
import { AgeText } from "@/components/farm/batches-section"
import { BatchDayPanel, type HistoryRow } from "@/components/farm/batch-day-panel"
import { BatchActions } from "@/components/farm/batch-actions"
import { BatchWeights, type WeightItem } from "@/components/farm/batch-weights"
import { loadWeights } from "@/server/weights"
import { weighDue, weightPoints } from "@/domain/weights"
import { cn } from "@/lib/utils"
import { ChevronLeft, Syringe } from "lucide-react"

const ymd = /^\d{4}-\d{2}-\d{2}$/

/** One batch: how it stands (on any day), the day's entry, its history, its money and (owner) its settings. */
export default async function BatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params
  const sp = await searchParams
  const { tenant, staff, db } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const t = await getTranslations("farm.batches")
  const tv = await getTranslations("farm.vaccines")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const isOwner = staff.roles.includes("owner")
  const today = istDate(new Date())

  const lastDay = (closed: string | null) => (closed && closed < today ? closed : today)
  // Look at the batch as it stood on a past day, when asked; never before its first day or after it closed.
  const probe = await batchBook(tenant.id, today)
  const row = probe.rows.find((r) => r.batch.id === id)
  if (!row) notFound()
  const { batch } = row
  const maxDate = lastDay(batch.closedDate)
  const asked = sp.date && ymd.test(sp.date) ? sp.date : maxDate
  const asOf = asked < batch.startDate ? batch.startDate : asked > maxDate ? maxDate : asked
  const book = asOf === today ? probe : await batchBook(tenant.id, asOf)
  const { info, status: s, money: m } = book.rows.find((r) => r.batch.id === id)!

  // Weekly weights: each weighing with the birds' age and growth since the one before.
  const weightRows = await loadWeights(tenant.id, id)
  const weights: WeightItem[] = weightPoints(info, weightRows).map((p, i) => ({ ...p, id: weightRows[i].id, dayText: dayLabel(p.date, locale, labels) }))
  const weighing = weighDue(batch, weightRows, today)
  const myDays = probe.days.filter((d) => d.batchId === id)
  const myLosses = probe.losses.filter((l) => l.batchId === id)
  const dates = [...new Set([...myDays.map((d) => d.date), ...myLosses.map((l) => l.date)])]
  const history: HistoryRow[] = dates.map((date) => {
    const d = myDays.find((x) => x.date === date)
    const losses = myLosses.filter((l) => l.date === date).map((l) => ({ cause: l.cause, count: l.count }))
    return {
      date,
      dayText: dayLabel(date, locale, labels),
      feedKg: d?.feedKg ?? null,
      eggsCollected: d?.eggsCollected ?? null,
      eggsBroken: d?.eggsBroken ?? null,
      sold: d?.sold ?? 0,
      soldPaise: d?.soldPaise ?? 0,
      given: d?.given ?? 0,
      note: probe.notes.find((n) => n.batchId === id && n.date === date)?.note ?? null,
      losses,
      lost: losses.reduce((a, l) => a + l.count, 0),
      aliveAfter: batchStatus(info, probe.days, probe.losses, date).alive,
    }
  })
  // Vaccinations: planned and given, with any cost from the dose's medicine expense.
  const [vaccinations, schedule, pastNames] = await Promise.all([
    db.batchVaccination.findMany({ where: { batchId: id } }),
    loadSchedule(tenant.id),
    db.batchVaccination.findMany({ distinct: ["vaccine"], select: { vaccine: true }, take: 50 }),
  ])
  const doseCosts = await db.expense.findMany({ where: { id: { in: vaccinations.flatMap((v) => (v.expenseId ? [v.expenseId] : [])) } }, select: { id: true, amountPaise: true } })
  const hatched = hatchDate(batch)
  const doses: DoseRow[] = vaccinations
    .map((v) => ({
      id: v.id,
      vaccine: v.vaccine,
      method: v.method,
      dueDate: v.dueDate,
      dueText: v.dueDate ? dayLabel(v.dueDate, locale, labels) : null,
      dueAge: v.dueDate ? daysBetween(hatched, v.dueDate) : null,
      givenDate: v.givenDate,
      givenText: v.givenDate ? dayLabel(v.givenDate, locale, labels) : null,
      birds: v.birds,
      costPaise: doseCosts.find((e) => e.id === v.expenseId)?.amountPaise ?? null,
      note: v.note,
      state: doseState(v, today),
    }))
    .sort((a, b) => (a.givenDate ?? a.dueDate ?? "").localeCompare(b.givenDate ?? b.dueDate ?? ""))
  const have = new Set(vaccinations.map((v) => `${v.vaccine.toLowerCase()}|${v.dueDate}`))
  const canApplySchedule = !batch.closedDate && planFor(batch, schedule).some((p) => p.dueDate >= today && !have.has(`${p.vaccine.toLowerCase()}|${p.dueDate}`))
  const dueNow = doses.filter((d) => d.state === "overdue" || d.state === "today").length
  const suggestions = [...new Set([...schedule.map((x) => x.vaccine), ...pastNames.map((x) => x.vaccine)])].sort()

  const parent = batch.parentBatchId ? probe.rows.find((r) => r.batch.id === batch.parentBatchId)?.batch : null
  const hatchRate = hatchRatePct(batch)
  const showEggs = batch.purpose !== "meat" || s.eggsCollected > 0
  const goodEggs = s.eggsCollected - s.eggsBroken
  const costPerBird = m.costPerBirdPaise

  const tile = (label: string, value: React.ReactNode, tone?: "bad") => (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", tone === "bad" && "text-destructive")}>{value}</div>
    </div>
  )
  const line = (label: string, value: string, strong = false) => (
    <li className={cn("flex justify-between gap-3 py-1.5 tabular-nums", strong && "font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </li>
  )

  return (
    <div className="flex flex-col gap-4">
      <Link href={asOf === today ? "/farm/poultry" : `/farm/poultry?on=${asOf}`} className="flex h-9 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary underline-offset-4 hover:underline">
        <ChevronLeft className="size-5" aria-hidden /> {t("backToPoultry")}
      </Link>

      {/* A thin, light bar that stays pinned under the app header: which batch this page is about, while scrolling. */}
      <div className="sticky z-10 -mx-4 -my-2 flex items-center gap-2 border-b bg-card/95 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border" style={{ top: "var(--app-header-h, 66px)" }}>
        <span className="line-clamp-2 min-w-0 leading-snug">
          <b className="text-base">{batch.name}</b> · {t("batchNo", { number: batch.number })} · {t("ageDays", { days: Math.max(0, s.ageDays) })} · {t("aliveCount", { count: s.alive })}
        </span>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <div>
          <h1 className="text-xl font-bold">
            {batch.name} <span className="font-normal text-muted-foreground">· {t("batchNo", { number: batch.number })}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{[batch.breed, t(`purpose_${batch.purpose}`), t(`source_${batch.source}`)].filter(Boolean).join(" · ")}</p>
        </div>
        {asOf !== maxDate && <p className="rounded-lg bg-yolk px-3 py-2 text-sm font-medium text-yolk-foreground">{t("lookingAt", { day: dayLabel(asOf, locale, labels) })}</p>}
        <div className="text-lg">
          <AgeText days={s.ageDays} />
        </div>
        {dueNow > 0 && (
          <a href="#vaccinations" className="flex items-center justify-between gap-2 rounded-lg bg-yolk px-3 py-2 text-sm font-semibold text-yolk-foreground">
            <span className="flex items-center gap-2">
              <Syringe className="size-4 shrink-0" /> {tv("dueBanner", { count: dueNow })}
            </span>
            <span aria-hidden>↓</span>
          </a>
        )}
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          <li>{t("dayOnFarm", { day: s.dayOnFarm, date: dayLabel(batch.startDate, locale, labels) })}</li>
          <li>{t("hatchedOn", { day: dayLabel(hatchDate(batch), locale, labels) })}</li>
          {batch.supplier && <li>{t("fromSupplier", { supplier: batch.supplier })}</li>}
          {parent && <li>{t("fromParent", { name: `${parent.name} · #${parent.number}` })}</li>}
          {batch.eggsSet != null && <li>{t("hatchLine", { set: batch.eggsSet, hatched: batch.startCount, rate: hatchRate ?? 0 })}</li>}
          {batch.note && <li>{batch.note}</li>}
        </ul>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tile(
            t("alive"),
            <>
              {s.alive}
              <span className="text-xs font-normal text-muted-foreground">/{batch.startCount}</span>
            </>
          )}
          {tile(t("lost"), `${s.lost} · ${s.lossPct}%`, s.lost > 0 ? "bad" : undefined)}
          {tile(t("soldGiven"), `${s.sold} + ${s.given}`)}
          {tile(t("feedTotal"), `${s.feedKg} kg`)}
          {showEggs && tile(t("goodEggs"), goodEggs)}
          {showEggs && s.eggsBroken > 0 && tile(t("eggsBroken"), s.eggsBroken)}
        </div>
        {s.lostByCause.length > 0 && (
          <ul className="divide-y text-sm">
            {s.lostByCause.map((l) => (
              <li key={l.cause} className="flex justify-between gap-3 py-1.5 tabular-nums">
                <span>{t(`cause_${l.cause}`)}</span>
                <span>
                  <b>{l.count}</b>
                  {isOwner && costPerBird > 0 && <span className="text-muted-foreground"> · {formatRupees(l.count * costPerBird)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BatchDayPanel batchId={id} batchName={batch.name} minDate={batch.startDate} maxDate={maxDate} initialDate={asOf} showEggs={showEggs} entries={history} />

      <BatchWeights
        batchId={id}
        batchName={batch.name}
        minDate={batch.startDate}
        maxDate={maxDate}
        weights={weights}
        due={weighing}
        open={weighing.due}
      />

      <BatchVaccinations
        batchId={id}
        today={today}
        minDate={batch.startDate}
        maxDate={maxDate}
        aliveNow={row.status.alive}
        isOwner={isOwner}
        canApplySchedule={canApplySchedule}
        doses={doses}
        suggestions={suggestions}
      />

      {isOwner && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-semibold">{t("moneyTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("moneyHint")}</p>
          <ul className="divide-y text-sm">
            {line(batch.source === "eggs_bought" ? t("moneyEggsBought") : t("moneyChicks"), formatRupees(m.chicksPaise))}
            {line(t("moneyFeed", { kg: s.feedKg }), m.feedPaise == null ? t("feedPriceUnknown") : formatRupees(m.feedPaise))}
            {line(t("moneyOther"), formatRupees(m.otherPaise))}
          </ul>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2 text-lg font-bold tabular-nums">
            <span>{t("moneyCost")}</span>
            <span>{formatRupees(m.costPaise)}</span>
          </div>
          <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground tabular-nums">
            {m.costPaise > 0 && <li>{t("costPerBird", { amount: formatRupees(m.costPerBirdPaise) })}</li>}
            {m.costPerEggPaise != null && <li>{t("costPerEgg", { amount: formatRupees(m.costPerEggPaise) })}</li>}
            {m.lostValuePaise > 0 && <li>{t("lostValue", { amount: formatRupees(m.lostValuePaise) })}</li>}
          </ul>
        </section>
      )}

      {isOwner && (
        <BatchActions
          id={id}
          today={today}
          startDate={batch.startDate}
          closedDate={batch.closedDate}
          closedText={batch.closedDate ? dayLabel(batch.closedDate, locale, labels) : null}
          name={batch.name}
          footprint={{ days: dates.length, lost: row.status.lost, doses: vaccinations.length, costPaise: row.money.chicksPaise + row.money.otherPaise }}
        />
      )}
    </div>
  )
}
