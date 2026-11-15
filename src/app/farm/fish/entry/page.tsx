import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { featuresOf } from "@/lib/features"
import { dayLabel } from "@/lib/i18n-helpers"
import { fishOnMenu, fishTabs } from "@/lib/farm-sections"
import { addDays, istDate } from "@/domain/ist"
import { fishBook, fishFeedItems } from "@/server/fish"
import { SectionHeader } from "@/components/farm/section-header"
import { FishDayForm } from "@/components/farm/fish-forms"
import { cn } from "@/lib/utils"

const ymd = /^\d{4}-\d{2}-\d{2}$/

/** Fishery · Entry: one pond's day (feed, fish found dead, water). Pick the pond; today unless another day is chosen. */
export default async function FishEntryPage({ searchParams }: { searchParams: Promise<{ cycle?: string; date?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "fishCare")
  const t = await getTranslations("farm.fish")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const who = { roles: staff.roles, features: featuresOf(tenant) }
  const book = await fishBook(db, today)
  const cycle = book.open.find((c) => c.id === sp.cycle) ?? book.open.find((c) => !c.enteredToday) ?? book.open[0]
  const date = sp.date && ymd.test(sp.date) && sp.date <= today && cycle && sp.date >= cycle.startDate ? sp.date : today
  const [feeds, existing] = cycle
    ? await Promise.all([fishFeedItems(db), db.fishDay.findFirst({ where: { cycleId: cycle.id, date } })])
    : [[], null]
  const href = (c: string, d = date) => `/farm/fish/entry?cycle=${c}${d === today ? "" : `&date=${d}`}`

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="fish" tabs={fishTabs(who)} active="entry" back={fishOnMenu(who) ? undefined : { href: "/farm/more" }} />
      {!cycle ? (
        <p className="py-10 text-center text-muted-foreground">{t("noCycles")}</p>
      ) : (
        <>
          {book.open.length > 1 && (
            <nav aria-label={t("pond")} className="flex flex-wrap gap-2">
              {book.open.map((c) => (
                <Link
                  key={c.id}
                  href={href(c.id, today)}
                  aria-current={c.id === cycle.id ? "page" : undefined}
                  className={cn("rounded-full border-2 px-4 py-2 font-semibold", c.id === cycle.id ? "border-sec-fish bg-sec-fish-tint" : "bg-card")}
                >
                  {c.pond} {c.enteredToday && "✓"}
                </Link>
              ))}
            </nav>
          )}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              {cycle.pond} · {dayLabel(date, locale, labels)}
            </h2>
            <span className="flex gap-2 text-sm font-semibold">
              {date > cycle.startDate && (
                <Link href={href(cycle.id, addDays(date, -1))} className="rounded-lg border px-3 py-1.5 hover:bg-accent">
                  ← {t("dayBefore")}
                </Link>
              )}
              {date < today && (
                <Link href={href(cycle.id, addDays(date, 1))} className="rounded-lg border px-3 py-1.5 hover:bg-accent">
                  {t("dayAfter")} →
                </Link>
              )}
            </span>
          </div>
          <FishDayForm key={`${cycle.id}-${date}`} cycleId={cycle.id} date={date} values={existing} feeds={feeds} left={cycle.left + (existing?.dead ?? 0)} />
        </>
      )}
    </div>
  )
}
