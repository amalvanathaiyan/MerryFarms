import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { listApplications } from "@/server/applications"
import { applicationNumber, isOpen } from "@/domain/applications"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"
import { ApplicationBadge } from "./application-badge"

const SHOWS = ["open", "approved", "rejected", "all"] as const
type Show = (typeof SHOWS)[number]

/**
 * Admin · Farms · Wanting to join: farms that registered themselves. Waiting ones first (oldest first, so no one
 * waits longest); the chips switch to approved, turned down or all. Each opens its review.
 */
export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const raw = (await searchParams).show
  const show: Show = SHOWS.find((s) => s === raw) ?? "open"
  const t = await getTranslations("admin.join")
  const ta = await getTranslations("admin")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const all = await listApplications()
  const matches = (status: string, s: Show) => s === "all" || (s === "open" ? isOpen(status) : status === s)
  const counts = Object.fromEntries(SHOWS.map((s) => [s, all.filter((a) => matches(a.status, s)).length])) as Record<Show, number>
  const shown = all.filter((a) => matches(a.status, show))
  if (show === "open") shown.reverse()
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/farms" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {ta("farms")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>

      <nav aria-label={t("title")} className="flex flex-wrap gap-2">
        {SHOWS.map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/farms/applications" : `/admin/farms/applications?show=${s}`}
            aria-current={s === show ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold", s === show ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}
          >
            {t(`show_${s}`)} <span className="tabular-nums">{counts[s]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{show === "open" ? t("noneWaiting") : t("noneHere")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/farms/applications/${a.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:border-primary">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-lg leading-snug font-bold">{a.nameTa}</span>
                    {a.nameEn && <span className="text-muted-foreground">· {a.nameEn}</span>}
                    <ApplicationBadge status={a.status} label={t(`state_${a.status}`)} />
                  </div>
                  <span className="text-sm">
                    {a.ownerName} · {a.district}
                    {a.modules.length > 0 && ` · ${a.modules.map((m) => (tm.has(m) ? tm(m) : m)).join(", ")}`}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {applicationNumber(a.number)} · {t("sent", { date: day.format(a.createdAt) })}
                    {a.plan && ` · ${pick(locale, a.plan.nameTa, a.plan.nameEn)}`}
                  </span>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
