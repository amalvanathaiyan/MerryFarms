import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"
import { istDate } from "@/domain/ist"
import { announcementState } from "@/domain/platform-billing"
import { Button } from "@/components/ui/button"
import { StopAnnouncement } from "./announcement-form"

/**
 * Admin · Announcements: notes to farms, shown on their Today page between two dates. Showing now and coming first,
 * each with Change and Stop; ended ones folded below.
 */
export default async function AdminAnnouncementsPage() {
  const t = await getTranslations("admin.announcements")
  const locale = await getLocale()
  const today = istDate(new Date())
  const rows = (await prisma.announcement.findMany({ orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }], take: 100 })).map((a) => ({ ...a, state: announcementState(a, today) }))
  const date = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
  const fmt = (d: string) => date.format(new Date(`${d}T00:00:00Z`))
  const open = rows.filter((a) => a.state !== "ended")
  const ended = rows.filter((a) => a.state === "ended").slice(0, 20)

  const row = (a: (typeof rows)[number]) => (
    <li key={a.id} className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-4", a.tone === "important" && a.state !== "ended" && "border-destructive/40")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0 font-semibold">{pick(locale, a.titleTa, a.titleEn)}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", a.state === "live" ? "bg-primary text-primary-foreground" : a.state === "coming" ? "bg-yolk text-yolk-foreground" : "bg-muted")}>{t(`state_${a.state}`)}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {a.onlyFarms.length ? t("someFarms", { count: a.onlyFarms.length }) : t("allFarms")} · {t(`audience_${a.audience}`)} · {a.endsOn ? t("fromTo", { from: fmt(a.startsOn), to: fmt(a.endsOn) }) : t("fromOn", { from: fmt(a.startsOn) })}
        {a.tone === "important" && ` · ${t("tone_important")}`}
      </p>
      {a.state !== "ended" && (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/announcements/${a.id}`}>{t("change")}</Link>
          </Button>
          <StopAnnouncement id={a.id} coming={a.state === "coming"} />
        </div>
      )}
    </li>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("hint")}</p>
        </div>
        <Button asChild size="lg" className="h-12 bg-sun text-base text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
          <Link href="/admin/announcements/new">
            <Plus /> {t("new")}
          </Link>
        </Button>
      </div>

      {open.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noneShowing")}</p> : <ul className="flex flex-col gap-3">{open.map(row)}</ul>}

      {ended.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">{t("endedShow", { count: ended.length })}</summary>
          <ul className="mt-2 flex flex-col gap-3">{ended.map(row)}</ul>
        </details>
      )}
    </div>
  )
}
