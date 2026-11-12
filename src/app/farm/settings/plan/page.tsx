import { getLocale, getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf, featureSource } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { pick } from "@/lib/i18n-helpers"
import { prisma } from "@/lib/prisma"
import { moduleSettings } from "@/server/subscriptions"
import { formatRupees } from "@/domain/money"
import { MODULE_KEYS, MODULES } from "@/domain/modules"
import { SectionHeader } from "@/components/farm/section-header"
import { PlanModules } from "@/components/farm/plan-modules"

/** Settings · Plan & modules (owner): what the farm has, what it can add, and its requests to Farm For You. */
export default async function SettingsPlanPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("farm.planModules")
  const locale = await getLocale()
  const source = featureSource(tenant)
  const [sub, plans, settings, requests] = await Promise.all([
    prisma.farmSubscription.findUnique({ where: { tenantId: tenant.id }, include: { plan: true } }),
    prisma.platformPlan.findMany({ where: { isPublic: true, retired: false }, orderBy: [{ sortOrder: "asc" }] }),
    moduleSettings(),
    prisma.farmRequest.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ])
  const has = typeof source === "string" ? null : source.modules
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
  const price = (paise: number | null) => (paise ? t("perMonth", { price: formatRupees(paise) }) : t("free"))

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(featuresOf(tenant))} active="plan" back={{ href: "/farm/more" }} />

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("yourPlan")}</h2>
        {sub ? (
          <>
            <p className="font-display text-2xl font-bold">{pick(locale, sub.plan.nameTa, sub.plan.nameEn)}</p>
            <p className="text-sm text-muted-foreground">
              {t(`status_${sub.status}`)}
              {sub.status === "trial" && sub.trialEndsAt && ` · ${t("trialUntil", { date: day.format(sub.trialEndsAt) })}`}
              {` · ${price(sub.priceOverridePaise ?? sub.plan.monthlyPaise)}`}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{t("noPlanYet")}</p>
        )}
      </section>

      <PlanModules
        modules={MODULE_KEYS.filter((m) => !MODULES[m].alwaysOn).map((m) => {
          const s = settings.find((x) => x.key === m)!
          return {
            key: m,
            has: has ? has.includes(m) : m === "selling" || (m === "poultry" && featuresOf(tenant).poultryCare),
            available: MODULES[m].available && s.enabled,
            requestable: s.requestable && !!sub,
            price: price(s.addOnMonthlyPaise),
            trialDays: s.addOnTrialDays,
          }
        })}
        plans={plans
          .filter((p) => p.id !== sub?.planId)
          .map((p) => ({ id: p.id, name: pick(locale, p.nameTa, p.nameEn), description: pick(locale, p.descriptionTa ?? "", p.descriptionEn ?? "") || null, price: price(p.monthlyPaise), modules: p.modules }))}
        requests={requests.map((r) => ({
          id: r.id,
          kind: r.kind,
          moduleKey: r.moduleKey,
          planName: (() => {
            const p = plans.find((x) => x.id === r.planId)
            return p ? pick(locale, p.nameTa, p.nameEn) : null
          })(),
          status: r.status,
          reply: r.reply,
          when: day.format(r.createdAt),
        }))}
      />
    </div>
  )
}
