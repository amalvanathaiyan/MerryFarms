import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronRight, Scale, Syringe } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { poultryTabs } from "@/lib/farm-sections"
import { batchStatus, onFarm } from "@/domain/batches"
import { istDate } from "@/domain/ist"
import { weighDue } from "@/domain/weights"
import { asDay, asInfo, asLoss, loadBatches } from "@/server/batches"
import { loadSchedule } from "@/server/vaccinations"
import { SectionHeader } from "@/components/farm/section-header"
import { AllBatchesDay, type DayBatch } from "@/components/farm/all-batches-day"
import { BatchEntryForm, type EntryDose } from "@/components/farm/batch-entry-form"
import { EntryDayPicker } from "@/components/farm/entry-day-picker"
import { cn } from "@/lib/utils"

const ymd = /^\d{4}-\d{2}-\d{2}$/

/**
 * Poultry care · Entry: the one place to enter what happened on a day. Pick the day and a batch (or all batches).
 * One batch: daily numbers, weighing and vaccines in three sections with one Save. All batches: the daily numbers
 * for every batch on one screen, with what's due listed on top. Records and reports live on the other tabs.
 */
export default async function PoultryEntryPage({ searchParams }: { searchParams: Promise<{ batch?: string; date?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const t = await getTranslations("farm.entry")
  const tb = await getTranslations("farm.batches")
  const tv = await getTranslations("farm.vaccines")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const date = sp.date && ymd.test(sp.date) && sp.date <= today ? sp.date : today
  const isOwner = staff.roles.includes("owner")

  const { batches, days, losses } = await loadBatches(tenant.id)
  const dayRows = days.map(asDay)
  const lossRows = losses.map(asLoss)
  const live = batches.filter((b) => onFarm(b, date)).sort((a, b) => a.number - b.number)
  // One batch on the farm: straight to it. Several: all of them, unless one is asked for.
  const picked = sp.batch !== "all" && live.some((b) => b.id === sp.batch) ? sp.batch! : live.length === 1 && sp.batch !== "all" ? live[0].id : "all"
  const batch = live.find((b) => b.id === picked) ?? null

  const aliveAtStart = (b: (typeof batches)[number]) => batchStatus(asInfo(b), dayRows.filter((x) => x.date < date), lossRows.filter((x) => x.date < date), date).alive
  const showEggs = (b: (typeof batches)[number]) => b.purpose !== "meat" || days.some((x) => x.batchId === b.id && (x.eggsCollected ?? 0) > 0)
  const savedDay = (id: string) => {
    const d = days.find((x) => x.batchId === id && x.date === date)
    const l = losses.filter((x) => x.batchId === id && x.date === date)
    return d || l.length ? { feedKg: d?.feedKg ?? null, eggsCollected: d?.eggsCollected ?? null, eggsBroken: d?.eggsBroken ?? null, sold: d?.sold ?? 0, soldPaise: d?.soldPaise ?? 0, given: d?.given ?? 0, note: d?.note ?? null, losses: l.map((x) => ({ cause: x.cause, count: x.count })) } : null
  }
  const lastFeed = (id: string) => [...days].reverse().find((x) => x.batchId === id && x.date < date && (x.feedKg ?? 0) > 0)?.feedKg ?? null
  const minDate = (batch ? batch.startDate : batches.map((b) => b.startDate).sort()[0]) ?? today
  const liveIds = live.map((b) => b.id)

  // What's due, for the batches on the farm: weighings and doses not given, due today or before.
  const [weighings, openDoses] = await Promise.all([
    db.batchWeight.findMany({ where: { batchId: { in: liveIds } }, orderBy: { date: "asc" } }),
    db.batchVaccination.findMany({ where: { batchId: { in: liveIds }, givenDate: null, dueDate: { lte: today } }, orderBy: { dueDate: "asc" } }),
  ])
  const dueOf = (id: string) => ({
    weigh: weighDue(live.find((b) => b.id === id)!, weighings.filter((w) => w.batchId === id), today),
    doses: openDoses.filter((d) => d.batchId === id),
  })

  let body: React.ReactNode
  if (live.length === 0) {
    body = <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("none")}</p>
  } else if (!batch) {
    const rows: DayBatch[] = live.map((b) => ({ id: b.id, name: b.name, number: b.number, alive: aliveAtStart(b), showEggs: showEggs(b), entry: savedDay(b.id), lastFeedKg: lastFeed(b.id) }))
    const due = live.map((b) => ({ b, ...dueOf(b.id) })).filter((x) => x.weigh.due || x.doses.length > 0)
    body = (
      <>
        {due.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-yolk bg-card p-3">
            <h2 className="font-bold">{t("dueTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("dueHint")}</p>
            <ul className="flex flex-col gap-2">
              {due.map(({ b, weigh, doses }) => (
                <li key={b.id}>
                  <Link href={`/farm/poultry/entry?batch=${b.id}${date === today ? "" : `&date=${date}`}`} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 hover:bg-accent">
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {b.name} <span className="font-normal text-muted-foreground">· {tb("batchNo", { number: b.number })}</span>
                      </span>
                      <span className="flex flex-wrap gap-x-3 text-sm">
                        {weigh.due && (
                          <span className="flex items-center gap-1">
                            <Scale className="size-4" aria-hidden /> {t("s2")}
                          </span>
                        )}
                        {doses.length > 0 && (
                          <span className={cn("flex items-center gap-1", doses.some((d) => d.dueDate! < today) && "font-semibold text-destructive")}>
                            <Syringe className="size-4" aria-hidden /> {doses.map((d) => d.vaccine).join(", ")}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-primary">
                      {t("enter")} <ChevronRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <AllBatchesDay key={date} date={date} batches={rows} />
      </>
    )
  } else {
    const { weigh, doses } = dueOf(batch.id)
    const mine = weighings.filter((w) => w.batchId === batch.id)
    const [givenOnDay, schedule, pastNames] = await Promise.all([
      db.batchVaccination.findMany({ where: { batchId: batch.id, givenDate: date }, select: { vaccine: true, birds: true } }),
      loadSchedule(tenant.id),
      db.batchVaccination.findMany({ distinct: ["vaccine"], select: { vaccine: true }, take: 50 }),
    ])
    const onDay = mine.find((w) => w.date === date)
    const entryDoses: EntryDose[] = doses.map((d) => ({
      id: d.id,
      vaccine: d.vaccine,
      method: d.method,
      dueText: d.dueDate === today ? tv("dueToday") : tv("overdueSince", { day: dayLabel(d.dueDate!, locale, labels) }),
      late: d.dueDate! < today,
    }))
    body = (
      <BatchEntryForm
        key={`${batch.id}-${date}`}
        batch={{ id: batch.id, name: batch.name, number: batch.number, alive: aliveAtStart(batch), showEggs: showEggs(batch) }}
        date={date}
        isOwner={isOwner}
        saved={savedDay(batch.id)}
        lastFeedKg={lastFeed(batch.id)}
        weighing={{ due: weigh.due, daysSince: weigh.daysSince, onDay: onDay ? { birds: onDay.birds, totalGrams: onDay.totalGrams } : null, lastBirds: mine.at(-1)?.birds ?? null }}
        doses={entryDoses}
        givenOnDay={givenOnDay}
        suggestions={[...new Set([...schedule.map((x) => x.vaccine), ...pastNames.map((x) => x.vaccine)])].sort()}
      />
    )
  }

  const chip = (key: string, text: React.ReactNode, sub?: string) => (
    <Link
      key={key}
      href={`/farm/poultry/entry?batch=${key}${date === today ? "" : `&date=${date}`}`}
      aria-current={picked === key ? "page" : undefined}
      className={cn("flex min-h-11 flex-col justify-center rounded-xl border-2 px-3 py-1 leading-tight", picked === key ? "border-sec-poultry bg-sec-poultry-tint font-bold" : "bg-card font-semibold hover:bg-accent")}
    >
      <span>{text}</span>
      {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
    </Link>
  )

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" tabs={poultryTabs({ roles: staff.roles, features: featuresOf(tenant) })} active="entry" />

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
        <EntryDayPicker date={date} today={today} minDate={minDate} batch={picked} />
        {live.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold">{t("batch")}</span>
            <nav aria-label={t("batch")} className="flex flex-wrap gap-2">
              {chip("all", t("allBatches"), t("allBatchesHint"))}
              {live.map((b) => chip(b.id, `${b.name} · #${b.number}`, tb("aliveCount", { count: aliveAtStart(b) })))}
            </nav>
          </div>
        )}
        {date !== today && <p className="rounded-lg bg-yolk px-3 py-2 text-sm font-medium text-yolk-foreground">{t("pastDay", { day: dayLabel(date, locale, labels) })}</p>}
      </div>

      {batch && (
        <div className="-mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="text-xl font-bold">
            {batch.name} <span className="font-normal text-muted-foreground">· {tb("batchNo", { number: batch.number })}</span>
          </h2>
          <Link href={`/farm/poultry/batches/${batch.id}`} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            {t("seeRecords")} →
          </Link>
        </div>
      )}

      {body}
    </div>
  )
}
