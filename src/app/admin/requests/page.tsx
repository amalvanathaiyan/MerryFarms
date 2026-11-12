import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { isModuleKey } from "@/domain/modules"
import { RequestDecision } from "./request-decision"

/** What farms have asked for (add-on modules, plan changes): waiting ones first, then the last 30 decided. */
export default async function AdminRequestsPage() {
  const t = await getTranslations("admin.requests")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const [waiting, decided, plans] = await Promise.all([
    prisma.farmRequest.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { id: true, nameTa: true, nameEn: true } } } }),
    prisma.farmRequest.findMany({ where: { status: { not: "pending" } }, orderBy: { updatedAt: "desc" }, take: 30, include: { tenant: { select: { id: true, nameTa: true, nameEn: true } } } }),
    prisma.platformPlan.findMany({ select: { id: true, nameTa: true, nameEn: true, version: true } }),
  ])
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
  const what = (r: { kind: string; moduleKey: string | null; planId: string | null }) => {
    if (r.kind === "add_on" && isModuleKey(r.moduleKey)) return t("wantsAddOn", { module: tm(r.moduleKey) })
    const p = plans.find((x) => x.id === r.planId)
    return t("wantsPlan", { plan: p ? pick(locale, p.nameTa, p.nameEn) : "?" })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("waiting", { count: waiting.length })}</h2>
        {waiting.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-muted-foreground">{t("none")}</p>}
        {waiting.map((r) => (
          <article key={r.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <a href={`/admin/farms/${r.tenant.id}`} className="text-lg font-bold hover:text-primary">
                {pick(locale, r.tenant.nameTa, r.tenant.nameEn)}
              </a>
              <span className="text-sm text-muted-foreground">{day.format(r.createdAt)}</span>
            </div>
            <p className="font-medium">{what(r)}</p>
            {r.note && <p className="rounded-xl bg-muted p-3 text-sm">{r.note}</p>}
            <RequestDecision id={r.id} />
          </article>
        ))}
      </section>

      {decided.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{t("decided")}</h2>
          <ul className="flex flex-col divide-y rounded-3xl border bg-card">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span>
                  <span className="font-semibold">{pick(locale, r.tenant.nameTa, r.tenant.nameEn)}</span> · {what(r)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t(`status_${r.status}`)}
                  {r.decidedBy && ` · ${r.decidedBy}`} · {day.format(r.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
