import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { isModuleKey } from "@/domain/modules"
import { moduleSettings } from "@/server/subscriptions"
import { RequestDecision } from "./request-decision"

/**
 * What farms have asked for (add-on modules, plan changes). Each waiting one says what the farm has now, what it
 * wants and at what price, so it can be answered here without opening the farm; one that can't be approved yet (an
 * add-on for a farm with no plan) says so and links to the farm. Then the last 30 answered, with the reply sent.
 */
export default async function AdminRequestsPage() {
  const t = await getTranslations("admin.requests")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const include = { tenant: { select: { id: true, nameTa: true, nameEn: true, subscription: { select: { status: true, billingCycle: true, priceOverridePaise: true, plan: { select: { nameTa: true, nameEn: true, monthlyPaise: true } } } } } } }
  const [waiting, decided, plans, mods] = await Promise.all([
    prisma.farmRequest.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, include }),
    prisma.farmRequest.findMany({ where: { status: { not: "pending" } }, orderBy: { updatedAt: "desc" }, take: 30, include }),
    prisma.platformPlan.findMany({ select: { id: true, nameTa: true, nameEn: true, version: true, monthlyPaise: true, trialDays: true } }),
    moduleSettings(),
  ])
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
  const perMonth = (paise: number | null | undefined) => (paise ? t("perMonth", { price: formatRupees(paise) }) : t("free"))
  const what = (r: { kind: string; moduleKey: string | null; planId: string | null }) => {
    if (r.kind === "add_on" && isModuleKey(r.moduleKey)) return t("wantsAddOn", { module: tm(r.moduleKey) })
    const p = plans.find((x) => x.id === r.planId)
    return t("wantsPlan", { plan: p ? pick(locale, p.nameTa, p.nameEn) : "?" })
  }
  // The price of what was asked for, and what approving does
  const terms = (r: (typeof waiting)[number]) => {
    if (r.kind === "add_on" && isModuleKey(r.moduleKey)) {
      const m = mods.find((x) => x.key === r.moduleKey)
      return t("addOnTerms", { price: perMonth(m?.addOnMonthlyPaise), days: m?.addOnTrialDays ?? 0 })
    }
    const p = plans.find((x) => x.id === r.planId)
    return p ? (r.tenant.subscription ? t("planTermsMove", { price: perMonth(p.monthlyPaise) }) : t("planTermsNew", { price: perMonth(p.monthlyPaise), days: p.trialDays })) : null
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
        {waiting.map((r) => {
          const sub = r.tenant.subscription
          const blocked = r.kind === "add_on" && !sub
          return (
            <article key={r.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/admin/farms/${r.tenant.id}`} className="text-lg font-bold hover:text-primary">
                  {pick(locale, r.tenant.nameTa, r.tenant.nameEn)}
                </Link>
                <span className="text-sm text-muted-foreground">{day.format(r.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="font-semibold">{what(r)}</p>
                {terms(r) && <p className="text-sm">{terms(r)}</p>}
                <p className="text-sm text-muted-foreground">
                  {sub ? t("hasNow", { plan: pick(locale, sub.plan.nameTa, sub.plan.nameEn), price: perMonth(sub.priceOverridePaise ?? sub.plan.monthlyPaise) }) : t("hasNoPlan")}
                </p>
              </div>
              {r.note && <p className="rounded-xl bg-muted p-3 text-sm">{r.note}</p>}
              {blocked ? (
                <p className="rounded-xl bg-yolk p-3 text-sm text-yolk-foreground">
                  {t("needsPlanFirst")}{" "}
                  <Link href={`/admin/farms/${r.tenant.id}`} className="font-semibold underline underline-offset-4">
                    {t("openFarm")}
                  </Link>
                </p>
              ) : null}
              <RequestDecision id={r.id} canApprove={!blocked} />
            </article>
          )
        })}
      </section>

      {decided.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">{t("decided")}</h2>
          <ul className="flex flex-col divide-y rounded-3xl border bg-card">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 p-4">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span>
                    <span className="font-semibold">{pick(locale, r.tenant.nameTa, r.tenant.nameEn)}</span> · {what(r)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(`status_${r.status}`)}
                    {r.decidedBy && ` · ${r.decidedBy}`} · {day.format(r.updatedAt)}
                  </span>
                </div>
                {r.reply && <p className="text-sm text-muted-foreground">{t("replied", { reply: r.reply })}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
