import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { poultryTabs } from "@/lib/farm-sections"
import { addDays, istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { batchBook } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { FeedBuyForm } from "@/components/farm/feed-buy-form"
import { FEED_DAYS_WARNING, feedDaysLeft } from "@/domain/alerts"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

const SHOW_DAYS = 90

/**
 * Poultry care · Feed: on top, how much is left, how long it lasts and feed bought (owner; prices only for the owner).
 * Below, the feed given to each batch, day by day, with what it cost the batch (owner): feed is bought for the whole
 * farm and charged to each batch by the kg it was given.
 */
export default async function PoultryFeedPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const t = await getTranslations("farm.feed")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const isOwner = staff.roles.includes("owner")

  const [book, buys] = await Promise.all([
    batchBook(tenant.id, today),
    isOwner ? db.expense.findMany({ where: { kind: "feed" }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 10 }) : Promise.resolve([]),
  ])
  const feed = book.feed
  // Feed given per day over the last 7 days (only days with feed entered), to say about how long the store lasts.
  // The same reckoning as the "feed running out" alert on Today.
  const lasts = feed.leftKg > 0 ? feedDaysLeft(feed, book.days, today) : null
  const perDay = lasts?.perDay ?? 0
  const daysLeft = lasts?.daysLeft ?? null
  const leftPct = feed.boughtKg > 0 ? Math.max(0, Math.min(100, (feed.leftKg / feed.boughtKg) * 100)) : 0
  const low = daysLeft != null && daysLeft <= FEED_DAYS_WARNING

  // Feed given, by batch: feed is bought for the whole farm, and each batch is charged for the kg it was given, at the
  // average price paid per kg (the same reckoning as the batch's own money). Batches on the farm first, open.
  const showAll = sp.all === "1"
  const since = addDays(today, -SHOW_DAYS + 1)
  const kg = (n: number) => Math.round(n * 100) / 100
  const monthName = (ym: string) => new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`))
  const groups = book.rows
    .map(({ batch, status, money }) => {
      const days = book.days.filter((d) => d.batchId === batch.id && (d.feedKg ?? 0) > 0).sort((x, y) => y.date.localeCompare(x.date))
      const shown = showAll ? days : days.filter((d) => d.date >= since)
      const months: { month: string; total: number; days: { date: string; kg: number }[] }[] = []
      for (const d of shown) {
        const month = d.date.slice(0, 7)
        const m = months.at(-1)
        if (m?.month === month) {
          m.days.push({ date: d.date, kg: d.feedKg ?? 0 })
          m.total = kg(m.total + (d.feedKg ?? 0))
        } else months.push({ month, total: d.feedKg ?? 0, days: [{ date: d.date, kg: d.feedKg ?? 0 }] })
      }
      return { batch, live: !batch.closedDate || batch.closedDate >= today, totalKg: status.feedKg, costPaise: money.feedPaise, hidden: days.length - shown.length, months }
    })
    .filter((g) => g.totalKg > 0)
    .sort((x, y) => Number(y.live) - Number(x.live) || x.batch.number - y.batch.number)
  const olderHidden = groups.some((g) => g.hidden > 0)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" tabs={poultryTabs({ roles: staff.roles, features: featuresOf(tenant) })} active="feed" />

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <p className="font-semibold text-muted-foreground">{t("left")}</p>
        {feed.boughtKg === 0 && feed.usedKg === 0 ? (
          <p className="text-muted-foreground">{isOwner ? t("emptyOwner") : t("emptyStaff")}</p>
        ) : (
          <>
            <p className={cn("font-display text-5xl leading-none font-bold tabular-nums", feed.leftKg < 0 && "text-destructive")}>{t("kgValue", { kg: feed.leftKg })}</p>
            <div className="h-3.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={t("leftOf", { left: feed.leftKg, bought: feed.boughtKg })}>
              <div className={cn("h-full rounded-full", low ? "bg-destructive" : "bg-sec-poultry")} style={{ width: `${leftPct}%` }} />
            </div>
            {daysLeft != null && <p className={cn("font-semibold", low ? "text-destructive" : "text-foreground")}>{t("lasts", { days: daysLeft, perDay })}</p>}
            <dl className={cn("grid gap-2 text-center", isOwner && feed.pricePerKgPaise != null ? "grid-cols-3" : "grid-cols-2")}>
              <div className="rounded-xl bg-muted/60 p-2">
                <dt className="text-sm text-muted-foreground">{t("bought")}</dt>
                <dd className="text-lg font-bold tabular-nums">{t("kgValue", { kg: feed.boughtKg })}</dd>
              </div>
              <div className="rounded-xl bg-muted/60 p-2">
                <dt className="text-sm text-muted-foreground">{t("given")}</dt>
                <dd className="text-lg font-bold tabular-nums">{t("kgValue", { kg: feed.usedKg })}</dd>
              </div>
              {isOwner && feed.pricePerKgPaise != null && (
                <div className="rounded-xl bg-muted/60 p-2">
                  <dt className="text-sm text-muted-foreground">{t("price")}</dt>
                  <dd className="text-lg font-bold tabular-nums">{t("perKg", { amount: formatRupees(feed.pricePerKgPaise) })}</dd>
                </div>
              )}
            </dl>
            {feed.leftKg < 0 && <p className="text-sm text-muted-foreground">{t("negative")}</p>}
          </>
        )}
      </section>

      {isOwner && <FeedBuyForm today={today} />}

      {isOwner && buys.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-muted-foreground">{t("history")}</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {buys.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block font-semibold">{b.quantityKg != null ? t("kgValue", { kg: b.quantityKg }) : t("noKg")}</span>
                  <span className="block text-sm text-muted-foreground">{[dayLabel(b.date, locale, labels), b.note].filter(Boolean).join(" · ")}</span>
                </span>
                <b className="shrink-0 tabular-nums">{formatRupees(b.amountPaise)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t("givenTitle")}</h2>
        {isOwner && groups.length > 0 && <p className="text-sm text-muted-foreground">{t("givenCostHint")}</p>}
        {groups.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("givenNone")}</p>}
        {groups.map((g) => (
          <details key={g.batch.id} open={g.live} className="group rounded-2xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 hover:bg-accent/40">
              <span className="min-w-0">
                <span className="block text-lg leading-tight font-bold">
                  {g.batch.name} <span className="font-normal text-muted-foreground">· #{g.batch.number}</span>
                </span>
                <span className="block text-sm text-muted-foreground">{g.live ? t("onFarm") : t("leftFarm")}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-right tabular-nums">
                  <b className="block">{t("kgValue", { kg: g.totalKg })}</b>
                  {isOwner && <span className="block text-sm text-muted-foreground">{g.costPaise == null ? t("costUnknown") : formatRupees(g.costPaise)}</span>}
                </span>
                <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="flex flex-col gap-2 border-t px-4 pt-2 pb-3">
              {g.months.length === 0 && <p className="py-1 text-sm text-muted-foreground">{t("givenNoneRecent", { days: SHOW_DAYS })}</p>}
              {g.months.map((m) => (
                <div key={m.month}>
                  <h3 className="flex items-baseline justify-between gap-2 py-1 text-sm font-semibold text-muted-foreground">
                    <span>{monthName(m.month)}</span>
                    <span className="tabular-nums">{t("kgValue", { kg: kg(m.total) })}</span>
                  </h3>
                  <ul className="divide-y divide-dashed">
                    {m.days.map((d) => (
                      <li key={d.date} className="flex justify-between gap-3 py-1.5 tabular-nums">
                        <span>{dayLabel(d.date, locale, labels)}</span>
                        <span className="font-semibold">{t("kgValue", { kg: d.kg })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ))}
        {!showAll && olderHidden && (
          <Link href="/farm/poultry/feed?all=1" className="self-center text-sm font-semibold text-primary underline underline-offset-4">
            {t("showOlder")}
          </Link>
        )}
      </section>
    </div>
  )
}
