import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ExternalLink, Plus } from "lucide-react"
import { listFarms } from "@/server/platform"
import { statusLabel } from "@/domain/tenants"
import { formatRupees } from "@/domain/money"
import { pick } from "@/lib/i18n-helpers"
import { farmUrl } from "@/lib/farm-url"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FarmMark, StatusBadge } from "../farm-bits"

const SHOWS = ["all", "active", "trial", "trial_over", "suspended", "quiet"] as const
type Show = (typeof SHOWS)[number]

/**
 * Admin · Farms: every farm, and the one place to add a farm. The counts are the filters above the list (a count
 * with nothing in it is left out), so each number does something. Each farm card has one way in (Manage) and the
 * farm's shop.
 */
export default async function AdminFarms({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const raw = (await searchParams).show
  const show: Show = SHOWS.find((s) => s === raw) ?? "all"
  const t = await getTranslations("admin")
  const locale = await getLocale()
  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const farms = (await listFarms(now)).map((f) => ({ ...f, label: statusLabel(f.status, f.trialEndsAt, now), quiet: !f.lastOrderAt || f.lastOrderAt < since30 }))
  const matches = (f: (typeof farms)[number], s: Show) => s === "all" || (s === "quiet" ? f.quiet : f.label === s)
  const counts = Object.fromEntries(SHOWS.map((s) => [s, farms.filter((f) => matches(f, s)).length])) as Record<Show, number>
  const shown = farms.filter((f) => matches(f, show))
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
  const showLabel = (s: Show) => (s === "all" ? t("farmsTotal") : s === "quiet" ? t("noOrders30") : t(`status_${s}`))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("farms")}</h1>
        <Button asChild size="lg" className="h-12 bg-sun text-base text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
          <Link href="/admin/farms/new">
            <Plus /> {t("newFarm")}
          </Link>
        </Button>
      </div>

      {farms.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noFarms")}</p>
      ) : (
        <>
          <nav aria-label={t("summary")} className="flex flex-wrap gap-2">
            {SHOWS.filter((s) => s === "all" || s === show || counts[s] > 0).map((s) => (
              <Link
                key={s}
                href={s === "all" ? "/admin/farms" : `/admin/farms?show=${s}`}
                aria-current={s === show ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold",
                  s === show ? "border-primary bg-primary text-primary-foreground" : (s === "trial_over" || s === "quiet") && counts[s] > 0 ? "border-yolk bg-yolk text-yolk-foreground" : "bg-card hover:border-primary"
                )}
              >
                {showLabel(s)} <span className="tabular-nums">{counts[s]}</span>
              </Link>
            ))}
          </nav>

          {shown.length === 0 && <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noneHere")}</p>}

          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map((f) => (
              <li key={f.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <FarmMark logoUrl={f.logoUrl} initials={f.invoicePrefix} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-display text-lg leading-snug font-bold">{pick(locale, f.nameTa, f.nameEn)}</span>
                    <span className="text-sm text-muted-foreground" lang="en">
                      {f.slug} · {f.phone}
                    </span>
                  </div>
                  <StatusBadge status={f.label} label={t(`status_${f.label}`)} />
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-accent px-2.5 py-0.5 font-medium">{t(`plan_${f.plan}`)}</span>
                  {f.status === "trial" && f.trialEndsAt && <span className="rounded-full border px-2.5 py-0.5">{t("trialEnds", { date: day.format(f.trialEndsAt) })}</span>}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t("orders30")}</dt>
                    <dd className="font-semibold tabular-nums">{f.orders30}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("sales30")}</dt>
                    <dd className="font-semibold tabular-nums">{formatRupees(f.sales30Paise)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("customers")}</dt>
                    <dd className="font-semibold tabular-nums">{f.customers}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("lastOrder")}</dt>
                    <dd className="font-semibold">{f.lastOrderAt ? day.format(f.lastOrderAt) : "—"}</dd>
                  </div>
                </dl>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/admin/farms/${f.id}`}>{t("manage")}</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <a href={farmUrl(f.slug)} target="_blank" rel="noreferrer">
                      <ExternalLink /> {t("openShop")}
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
