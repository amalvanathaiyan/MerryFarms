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
import { cn } from "@/lib/utils"

/** Poultry care · Feed: how much is left, how long it lasts, and feed bought (owner). Prices only for the owner. */
export default async function PoultryFeedPage() {
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
  const weekAgo = addDays(today, -6)
  const lastWeek = book.days.filter((d) => d.date >= weekAgo && d.date <= today && (d.feedKg ?? 0) > 0)
  const feedDays = new Set(lastWeek.map((d) => d.date)).size
  const perDay = feedDays ? Math.round((lastWeek.reduce((a, d) => a + (d.feedKg ?? 0), 0) / feedDays) * 10) / 10 : 0
  const daysLeft = perDay > 0 && feed.leftKg > 0 ? Math.floor(feed.leftKg / perDay) : null
  const leftPct = feed.boughtKg > 0 ? Math.max(0, Math.min(100, (feed.leftKg / feed.boughtKg) * 100)) : 0
  const low = daysLeft != null && daysLeft <= 7

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
    </div>
  )
}
