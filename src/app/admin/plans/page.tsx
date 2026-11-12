import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { MODULES, type ModuleKey } from "@/domain/modules"
import { Button } from "@/components/ui/button"
import { StarterPlansButton } from "./plan-bits"

/** Plans the platform admin makes from modules (docs/platform-plan.md §3.5): price, trial, modules, farms on each. */
export default async function AdminPlansPage() {
  const t = await getTranslations("admin.plans")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const plans = await prisma.platformPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { family: "asc" }, { version: "desc" }], include: { _count: { select: { subscriptions: true } } } })
  // One card per plan family: its newest version, with farms still on older ones counted
  const families = [...new Set(plans.map((p) => p.family))].map((f) => {
    const versions = plans.filter((p) => p.family === f)
    return { latest: versions[0], older: versions.slice(1), farms: versions.reduce((n, v) => n + v._count.subscriptions, 0) }
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("hint")}</p>
        </div>
        <Button asChild size="lg" className="h-12">
          <Link href="/admin/plans/new">
            <Plus /> {t("new")}
          </Link>
        </Button>
      </div>

      {families.length === 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border border-dashed bg-card p-5">
          <h2 className="text-lg font-bold">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground">{t("emptyHint")}</p>
          <StarterPlansButton />
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {families.map(({ latest: p, older, farms }) => (
          <Link key={p.id} href={`/admin/plans/${p.id}`} className="flex flex-col gap-3 rounded-3xl border bg-card p-5 transition-colors hover:border-primary">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">{pick(locale, p.nameTa, p.nameEn)}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("version", { n: p.version })} · {p.isPublic ? t("public") : t("private")}
                  {p.retired && ` · ${t("retired")}`}
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-bold tabular-nums">{p.monthlyPaise ? formatRupees(p.monthlyPaise) : t("free")}</div>
                {p.monthlyPaise > 0 && <div className="text-xs text-muted-foreground">{t("perMonth")}</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm">{tm("core")}</span>
              {(p.modules as ModuleKey[]).filter((m) => MODULES[m]).map((m) => (
                <span key={m} className="rounded-full bg-accent px-2.5 py-0.5 text-sm">
                  {tm(m)}
                </span>
              ))}
            </div>
            <p className="text-sm">
              {t("farmsOn", { count: farms })}
              {p.trialDays > 0 && ` · ${t("trialDays", { days: p.trialDays })}`}
              {older.length > 0 && ` · ${t("olderVersions", { count: older.length })}`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
