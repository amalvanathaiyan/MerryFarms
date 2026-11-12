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

const SHOW_DAYS = 90

/**
 * Poultry care · Feed: on top, how much is left, how long it lasts and feed bought (owner; prices only for the owner).
 * Below, the feed given each day, every batch, by month: for one batch with the batch filter.
 */
export default async function PoultryFeedPage({ searchParams }: { searchParams: Promise<{ batch?: string; all?: string }> }) {
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

  // Feed given, day by day (newest first), for the batches that were given any.
  const fedIds = new Set(book.days.filter((d) => (d.feedKg ?? 0) > 0).map((d) => d.batchId))
  const fed = book.rows.map((r) => r.batch).filter((b) => fedIds.has(b.id)).sort((a, b) => a.number - b.number)
  const only = fed.find((b) => b.id === sp.batch) ?? null
  const showAll = sp.all === "1"
  const since = addDays(today, -SHOW_DAYS + 1)
  const given = book.days.filter((d) => (d.feedKg ?? 0) > 0 && (!only || d.batchId === only.id))
  const dates = [...new Set(given.map((d) => d.date))].sort().reverse()
  const shown = showAll ? dates : dates.filter((d) => d >= since)
  const kg = (n: number) => Math.round(n * 100) / 100
  const byMonth: { month: string; total: number; days: { date: string; total: number; parts: { name: string; kg: number }[] }[] }[] = []
  for (const date of shown) {
    const rows = given.filter((d) => d.date === date)
    const day = {
      date,
      total: kg(rows.reduce((a, d) => a + (d.feedKg ?? 0), 0)),
      parts: fed.flatMap((b) => {
        const r = rows.find((d) => d.batchId === b.id)
        return r ? [{ name: `${b.name} · #${b.number}`, kg: r.feedKg ?? 0 }] : []
      }),
    }
    const month = date.slice(0, 7)
    const m = byMonth.at(-1)
    if (m?.month === month) {
      m.days.push(day)
      m.total = kg(m.total + day.total)
    } else byMonth.push({ month, total: day.total, days: [day] })
  }
  const monthName = (ym: string) => new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`))
  const href = (batch: string | null, all = showAll) => {
    const q = [batch && `batch=${batch}`, all && "all=1"].filter(Boolean).join("&")
    return `/farm/poultry/feed${q ? `?${q}` : ""}`
  }

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
        {fed.length > 1 && (
          <nav aria-label={t("filterBatch")} className="flex flex-wrap gap-2">
            {[{ id: null, label: t("allBatches") }, ...fed.map((b) => ({ id: b.id, label: `${b.name} · #${b.number}` }))].map((c) => (
              <Link
                key={c.id ?? "all"}
                href={href(c.id)}
                aria-current={(only?.id ?? null) === c.id ? "page" : undefined}
                className={cn("flex min-h-11 items-center rounded-xl border-2 px-3 text-sm", (only?.id ?? null) === c.id ? "border-sec-poultry bg-sec-poultry-tint font-bold" : "bg-card font-semibold hover:bg-accent")}
              >
                {c.label}
              </Link>
            ))}
          </nav>
        )}
        {byMonth.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{dates.length ? t("givenNoneRecent", { days: SHOW_DAYS }) : t("givenNone")}</p>}
        {byMonth.map((m) => (
          <div key={m.month} className="flex flex-col gap-1">
            <h3 className="flex items-baseline justify-between gap-2 px-1 font-semibold text-muted-foreground">
              <span>{monthName(m.month)}</span>
              <span className="tabular-nums">{t("kgValue", { kg: m.total })}</span>
            </h3>
            <ul className="divide-y rounded-2xl border bg-card">
              {m.days.map((d) => (
                <li key={d.date} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="block font-semibold">{dayLabel(d.date, locale, labels)}</span>
                    {!only && d.parts.length > 1 && <span className="block text-sm text-muted-foreground tabular-nums">{d.parts.map((p) => `${p.name}: ${p.kg}`).join(" · ")}</span>}
                    {!only && d.parts.length === 1 && fed.length > 1 && <span className="block text-sm text-muted-foreground">{d.parts[0].name}</span>}
                  </span>
                  <b className="shrink-0 tabular-nums">{t("kgValue", { kg: d.total })}</b>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!showAll && dates.length > shown.length && (
          <Link href={href(only?.id ?? null, true)} className="self-center text-sm font-semibold text-primary underline underline-offset-4">
            {t("showOlder")}
          </Link>
        )}
      </section>
    </div>
  )
}
