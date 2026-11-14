import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { istDate } from "@/domain/ist"
import { AnnouncementForm, type AnnouncementDraft } from "../announcement-form"

/** Admin · A new announcement (/admin/announcements/new) or a change to one. */
export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations("admin.announcements")
  const locale = await getLocale()
  const today = istDate(new Date())
  const [row, farms] = await Promise.all([
    id === "new" ? null : prisma.announcement.findUnique({ where: { id } }),
    prisma.tenant.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameTa: true, nameEn: true } }),
  ])
  if (id !== "new" && !row) notFound()
  const initial: AnnouncementDraft = row
    ? {
        titleTa: row.titleTa,
        titleEn: row.titleEn,
        bodyTa: row.bodyTa ?? "",
        bodyEn: row.bodyEn ?? "",
        tone: row.tone === "important" ? "important" : "info",
        audience: row.audience === "everyone" ? "everyone" : "owners",
        onlyFarms: row.onlyFarms,
        startsOn: row.startsOn,
        endsOn: row.endsOn ?? "",
      }
    : { titleTa: "", titleEn: "", bodyTa: "", bodyEn: "", tone: "info", audience: "owners", onlyFarms: [], startsOn: today, endsOn: "" }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Link href="/admin/announcements" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {t("title")}
      </Link>
      <h1 className="text-2xl font-bold">{row ? t("changeTitle") : t("new")}</h1>
      <AnnouncementForm id={row?.id ?? null} initial={initial} farms={farms.map((f) => ({ id: f.id, name: pick(locale, f.nameTa, f.nameEn) }))} today={today} />
    </div>
  )
}
