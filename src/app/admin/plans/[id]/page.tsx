import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { cleanFeatureRules, cleanLimits } from "@/domain/entitlements"
import { SectionBack } from "../section-back"
import { PlanEditor } from "../plan-editor"

/** Make a plan (/admin/plans/new) or change one. */
export default async function AdminPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations("admin.plans")
  const locale = await getLocale()
  const plan = id === "new" ? null : await prisma.platformPlan.findUnique({ where: { id }, include: { _count: { select: { subscriptions: true } } } })
  if (id !== "new" && !plan) notFound()
  const farms = plan
    ? await prisma.farmSubscription.findMany({ where: { planId: plan.id }, select: { tenant: { select: { id: true, nameTa: true, nameEn: true } } } })
    : []

  return (
    <div className="flex flex-col gap-5">
      <SectionBack href="/admin/plans" label={t("title")} />
      <h1 className="text-2xl font-bold sm:text-3xl">{plan ? pick(locale, plan.nameTa, plan.nameEn) : t("new")}</h1>
      <PlanEditor
        id={plan?.id ?? null}
        farmsOn={plan?._count.subscriptions ?? 0}
        retired={plan?.retired ?? false}
        initial={{
          nameTa: plan?.nameTa ?? "",
          nameEn: plan?.nameEn ?? "",
          descriptionTa: plan?.descriptionTa ?? "",
          descriptionEn: plan?.descriptionEn ?? "",
          monthlyRupees: plan ? plan.monthlyPaise / 100 : 0,
          yearlyRupees: plan?.yearlyPaise != null ? plan.yearlyPaise / 100 : null,
          trialDays: plan?.trialDays ?? 30,
          modules: plan?.modules ?? ["selling"],
          features: cleanFeatureRules(plan?.features),
          limits: cleanLimits(plan?.limits),
          isPublic: plan?.isPublic ?? true,
          sortOrder: plan?.sortOrder ?? 0,
        }}
      />
      {farms.length > 0 && (
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="text-lg font-bold">{t("farmsOnThis")}</h2>
          <ul className="flex flex-wrap gap-2">
            {farms.map(({ tenant }) => (
              <li key={tenant.id}>
                <a href={`/admin/farms/${tenant.id}`} className="block rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary">
                  {pick(locale, tenant.nameTa, tenant.nameEn)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
