import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CalendarDays, CheckCircle2, PencilLine, Plus, Syringe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { weeksAndDays, type BatchStatus } from "@/domain/batches"
import { cn } from "@/lib/utils"

export interface BatchCard {
  id: string
  number: number
  name: string
  breed: string | null
  purpose: string
  source: string
  startCount: number
  startDayText: string
  hatchDayText: string
  status: BatchStatus
  enteredToday: boolean
  /** Doses due today or late. */
  vaccinesDue: string[]
}

/** Age as words: "31 days old · 4 weeks 3 days". */
export async function AgeText({ days }: { days: number }) {
  const t = await getTranslations("farm.batches")
  const w = weeksAndDays(Math.max(0, days))
  return (
    <>
      {t("ageDays", { days: Math.max(0, days) })}
      {w.weeks > 0 && <span className="text-muted-foreground"> · {t("ageWeeks", { weeks: w.weeks, rest: w.days })}</span>}
    </>
  )
}

/** Poultry care's first tab: the batches on the farm (on any day), each with its one next step. */
export async function BatchesSection({
  cards,
  closed,
  asOf,
  asOfText,
  isToday,
  today,
  canManage,
}: {
  cards: BatchCard[]
  closed: BatchCard[]
  asOf: string
  asOfText: string
  isToday: boolean
  today: string
  canManage: boolean
}) {
  const t = await getTranslations("farm.batches")
  const tv = await getTranslations("farm.vaccines")
  const alive = cards.reduce((a, c) => a + c.status.alive, 0)
  const link = (c: BatchCard) => `/farm/poultry/batches/${c.id}${isToday ? "" : `?date=${asOf}`}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-display text-2xl font-bold">{isToday ? t("birdsNow", { count: alive }) : t("birdsOn", { count: alive, day: asOfText })}</p>
        <p className="text-sm text-muted-foreground">{t("batchCount", { count: cards.length })}</p>
      </div>
      {!isToday && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-yolk px-3 py-2 text-sm font-semibold text-yolk-foreground">
          {t("lookingAtFarm", { day: asOfText })}
          <Link href="/farm/poultry" className="underline underline-offset-4">
            {t("backToToday")}
          </Link>
        </p>
      )}

      {cards.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{isToday ? t("none") : t("noneOn", { day: asOfText })}</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <li key={c.id} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-4">
            <Link href={link(c)} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-lg leading-tight font-bold">
                  {c.name} <span className="font-normal text-muted-foreground">· {t("batchNo", { number: c.number })}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {[c.breed, t(`purpose_${c.purpose}`)].filter(Boolean).join(" · ")} · <AgeText days={c.status.ageDays} />
                </div>
              </div>
              {isToday && c.enteredToday && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-primary">
                  <CheckCircle2 className="size-4" aria-hidden /> {t("enteredToday")}
                </span>
              )}
            </Link>
            {isToday && c.vaccinesDue.length > 0 && (
              <Link href="/farm/poultry/vaccines" className="flex items-center gap-2 rounded-xl bg-yolk px-3 py-1.5 text-sm font-bold text-yolk-foreground">
                <Syringe className="size-4 shrink-0" aria-hidden /> {tv("dueOnCard", { names: c.vaccinesDue.join(", ") })}
              </Link>
            )}
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted/60 p-2">
                <dt className="text-sm text-muted-foreground">{t("alive")}</dt>
                <dd className="font-display text-2xl leading-tight font-bold tabular-nums">
                  {c.status.alive}
                  <span className="text-sm font-normal text-muted-foreground">/{c.startCount}</span>
                </dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-2">
                <dt className="text-sm text-muted-foreground">{t("lost")}</dt>
                <dd className={cn("font-display text-2xl leading-tight font-bold tabular-nums", c.status.lost > 0 && "text-destructive")}>{c.status.lost}</dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-2">
                <dt className="text-sm text-muted-foreground">{t("soldGiven")}</dt>
                <dd className="font-display text-2xl leading-tight font-bold tabular-nums">{c.status.sold + c.status.given}</dd>
              </div>
            </dl>
            {isToday && (
              <Link
                href={link(c)}
                className={cn(
                  "flex h-12 items-center justify-center gap-2 rounded-xl text-base font-bold",
                  c.enteredToday ? "border-2 border-border bg-card text-foreground hover:bg-accent" : "bg-sec-poultry text-sec-on"
                )}
              >
                <PencilLine className="size-5" aria-hidden /> {c.enteredToday ? t("changeToday") : t("enterTodayButton")}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3">
        {canManage && (
          <Button asChild variant="outline" className="h-12 rounded-2xl border-2 text-base font-bold">
            <Link href="/farm/poultry/batches/new">
              <Plus className="size-5" aria-hidden /> {t("new")}
            </Link>
          </Button>
        )}
        <details className={cn("group rounded-2xl border-2 bg-card", !canManage && "col-span-2")}>
          <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 text-base font-bold">
            <CalendarDays className="size-5" aria-hidden /> {t("lookBack")}
          </summary>
          <form action="/farm/poultry" className="flex flex-col gap-2 p-2 pt-0">
            <Input type="date" name="on" max={today} defaultValue={asOf} aria-label={t("lookBack")} className="h-11" />
            <Button type="submit" variant="outline" className="h-11">
              {t("show")}
            </Button>
          </form>
        </details>
      </div>

      {closed.length > 0 && (
        <details className="rounded-2xl border bg-card p-3">
          <summary className="cursor-pointer font-semibold text-muted-foreground">{t("closedBatches", { count: closed.length })}</summary>
          <ul className="mt-2 divide-y">
            {closed.map((c) => (
              <li key={c.id}>
                <Link href={`/farm/poultry/batches/${c.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary">
                  <span className="min-w-0 truncate">
                    {c.name} · {t("batchNo", { number: c.number })}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {t("lost")} {c.status.lost} · {t("soldGiven")} {c.status.sold + c.status.given}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
