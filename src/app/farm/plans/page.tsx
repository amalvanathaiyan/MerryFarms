import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel, pick, weekdayNames } from "@/lib/i18n-helpers"
import { planItems } from "@/server/plans"
import { nextPlanDates } from "@/domain/plans"
import { istDate } from "@/domain/ist"
import { slotRangeLabel } from "@/domain/slots"
import { formatIndianMobile } from "@/domain/phone"
import { Button } from "@/components/ui/button"
import { PlanActions } from "@/components/farm/plan-actions"
import { cn } from "@/lib/utils"

const WEEK = [1, 2, 3, 4, 5, 6, 0]

export default async function PlansPage() {
  const { tenant, db, staff } = await requireStaff()
  requireFeature(tenant, "subscriptions")
  const locale = await getLocale()
  const t = await getTranslations("farm.plans")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const days = weekdayNames(locale)
  const canEdit = staff.roles.includes("owner") || staff.roles.includes("order_desk")

  const [plans, products] = await Promise.all([
    db.subscription.findMany({ where: { status: { not: "cancelled" } }, include: { customer: true, slot: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.product.findMany({ where: { deletedAt: null } }),
  ])
  const productById = new Map(products.map((p) => [p.id, p]))
  const today = istDate(new Date())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        {canEdit && (
          <Button asChild>
            <Link href="/farm/plans/new">{t("newPlan")}</Link>
          </Button>
        )}
      </div>
      {plans.length === 0 && <p className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">{t("none")}</p>}
      <ul className="flex flex-col gap-3">
        {plans.map((p) => {
          const next = nextPlanDates(p, p.slot, today, 3)
          const daysText = p.daysOfWeek.length === 7 ? t("everyDay") : WEEK.filter((d) => p.daysOfWeek.includes(d)).map((d) => days[d]).join(", ")
          return (
            <li key={p.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/farm/customers/${p.customerId}`} className="font-semibold underline-offset-4 hover:underline">
                    {p.customer.name}
                  </Link>
                  <div className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(p.customer.phone)}</div>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", p.status === "active" ? "bg-accent" : "bg-yolk text-yolk-foreground")}>
                  {p.status === "paused" && p.pausedUntil ? t("pausedUntil", { date: dayLabel(p.pausedUntil, locale, labels) }) : t(`status_${p.status}`)}
                </span>
              </div>
              <ul className="text-sm">
                {planItems(p.items).map((i) => {
                  const prod = productById.get(i.productId)
                  return (
                    <li key={i.productId}>
                      {i.qty} × {prod ? `${pick(locale, prod.nameTa, prod.nameEn)} (${pick(locale, prod.packTa, prod.packEn)})` : "—"}
                    </li>
                  )
                })}
              </ul>
              <div className="text-sm text-muted-foreground">
                {daysText} · {slotRangeLabel(p.slot.startTime, p.slot.endTime)}
                {p.discountPct > 0 && ` · ${t("discount", { pct: p.discountPct })}`}
              </div>
              <div className="text-sm">
                <span className="font-semibold">{t("next")}:</span> {next.length ? next.map((d) => dayLabel(d, locale, labels)).join(", ") : "—"}
              </div>
              {canEdit && <PlanActions planId={p.id} status={p.status} nextDate={next[0] ?? null} nextLabel={next[0] ? dayLabel(next[0], locale, labels) : ""} skipDates={p.skipDates.filter((d) => d >= today).map((d) => ({ date: d, label: dayLabel(d, locale, labels) }))} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
