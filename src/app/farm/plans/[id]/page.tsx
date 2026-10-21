import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { loadPlanFormData } from "@/server/plan-form"
import { planItems } from "@/server/plans"
import { PlanForm } from "@/components/farm/plan-form"

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenant, db } = await requireStaff(ORDER_DESK)
  requireFeature(tenant, "subscriptions")
  const t = await getTranslations("farm.plans")
  const plan = await db.subscription.findFirst({ where: { id, status: { not: "cancelled" } }, include: { customer: { include: { addresses: { orderBy: { createdAt: "desc" }, take: 5 } } } } })
  if (!plan) notFound()
  const data = await loadPlanFormData(tenant, await getLocale())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("editTitle", { name: plan.customer.name })}</h1>
      <PlanForm
        data={data}
        initial={{
          id: plan.id,
          customer: {
            id: plan.customer.id,
            name: plan.customer.name,
            phone: plan.customer.phone,
            addresses: plan.customer.addresses.map((a) => ({ id: a.id, line: a.line, landmark: a.landmark })),
          },
          addressId: plan.addressId,
          slotId: plan.slotId,
          items: Object.fromEntries(planItems(plan.items).map((i) => [i.productId, i.qty])),
          daysOfWeek: plan.daysOfWeek,
          paymentMethod: plan.paymentMethod === "upi_prepaid" ? "upi_on_delivery" : plan.paymentMethod,
          discountPct: plan.discountPct,
          startDate: plan.startDate,
          note: plan.note ?? "",
        }}
      />
    </div>
  )
}
