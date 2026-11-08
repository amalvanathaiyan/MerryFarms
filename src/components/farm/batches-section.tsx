import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CheckCircle2, Plus, Syringe } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { weeksAndDays, type BatchStatus } from "@/domain/batches"
import type { FeedStore } from "@/domain/batches"
import { formatRupees } from "@/domain/money"
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

/** Batches on the farm (as of a day), the feed store and a way to look back to any day. */
export async function BatchesSection({
  cards,
  closed,
  asOf,
  asOfText,
  isToday,
  today,
  canManage,
  feed,
}: {
  cards: BatchCard[]
  closed: BatchCard[]
  asOf: string
  asOfText: string
  isToday: boolean
  today: string
  canManage: boolean
  feed: FeedStore | null
}) {
  const t = await getTranslations("farm.batches")
  const tv = await getTranslations("farm.vaccines")
  const alive = cards.reduce((a, c) => a + c.status.alive, 0)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{isToday ? t("birdsNow", { count: alive }) : t("birdsOn", { count: alive, day: asOfText })}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/farm/records/vaccines">
                <Syringe className="size-4" /> {tv("farmPlan")}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/farm/records/batches/new">
                <Plus className="size-4" /> {t("new")}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <form action="/farm/records" className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/50 p-2">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          {t("lookBack")}
          <Input type="date" name="on" max={today} defaultValue={asOf} className="h-10 w-auto font-normal" />
        </label>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          {t("show")}
        </Button>
        {!isToday && (
          <Link href="/farm/records" className="flex h-10 items-center px-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("backToToday")}
          </Link>
        )}
      </form>

      {cards.length === 0 && <p className="text-sm text-muted-foreground">{isToday ? t("none") : t("noneOn", { day: asOfText })}</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              href={`/farm/records/batches/${c.id}${isToday ? "" : `?date=${asOf}`}`}
              className="flex h-full flex-col gap-2 rounded-xl border p-3 transition-colors hover:border-primary hover:bg-accent/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {c.name} <span className="font-normal text-muted-foreground">· {t("batchNo", { number: c.number })}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[c.breed, t(`purpose_${c.purpose}`), t(`source_${c.source}`)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {isToday &&
                  (c.enteredToday ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">
                      <CheckCircle2 className="size-3.5" /> {t("enteredToday")}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-dashed border-primary px-2 py-0.5 text-xs font-semibold text-primary">{t("enterToday")}</span>
                  ))}
              </div>
              <div className="text-sm">
                <AgeText days={c.status.ageDays} />
              </div>
              {isToday && c.vaccinesDue.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-lg bg-yolk px-2 py-1 text-xs font-semibold text-yolk-foreground">
                  <Syringe className="size-3.5 shrink-0" /> {tv("dueOnCard", { names: c.vaccinesDue.join(", ") })}
                </div>
              )}
              <div className="text-xs text-muted-foreground">{t("dayOnFarm", { day: c.status.dayOnFarm, date: c.startDayText })}</div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <dt className="text-xs text-muted-foreground">{t("alive")}</dt>
                  <dd className="text-lg font-bold tabular-nums">
                    {c.status.alive}
                    <span className="text-xs font-normal text-muted-foreground">/{c.startCount}</span>
                  </dd>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <dt className="text-xs text-muted-foreground">{t("lost")}</dt>
                  <dd className={cn("text-lg font-bold tabular-nums", c.status.lost > 0 && "text-destructive")}>
                    {c.status.lost}
                    <span className="text-xs font-normal text-muted-foreground"> · {c.status.lossPct}%</span>
                  </dd>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <dt className="text-xs text-muted-foreground">{t("soldGiven")}</dt>
                  <dd className="text-lg font-bold tabular-nums">{c.status.sold + c.status.given}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      {feed && (
        <div className="flex flex-col gap-1 rounded-xl border border-dashed p-3 text-sm">
          <h3 className="font-semibold">{t("feedStore")}</h3>
          {feed.boughtKg === 0 && feed.usedKg === 0 ? (
            <p className="text-muted-foreground">{t("feedStoreHint")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                <span>
                  {t("feedBought")}: <b>{feed.boughtKg} kg</b>
                </span>
                <span>
                  {t("feedUsed")}: <b>{feed.usedKg} kg</b>
                </span>
                <span>
                  {t("feedLeft")}: <b className={cn(feed.leftKg < 0 && "text-destructive")}>{feed.leftKg} kg</b>
                </span>
                {feed.pricePerKgPaise != null && (
                  <span>
                    {t("feedPrice")}: <b>{formatRupees(feed.pricePerKgPaise)}/kg</b>
                  </span>
                )}
              </div>
              {feed.leftKg < 0 && <p className="text-xs text-muted-foreground">{t("feedNegative")}</p>}
            </>
          )}
        </div>
      )}

      {closed.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">{t("closedBatches", { count: closed.length })}</summary>
          <ul className="mt-2 divide-y">
            {closed.map((c) => (
              <li key={c.id}>
                <Link href={`/farm/records/batches/${c.id}`} className="flex justify-between gap-3 py-2 hover:text-primary">
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
    </section>
  )
}
