import { getLocale, getTranslations } from "next-intl/server"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { loadPlanFormData } from "@/server/plan-form"
import { PlanForm } from "@/components/farm/plan-form"

export default async function NewPlanPage() {
  const { tenant } = await requireStaff(ORDER_DESK)
  requireFeature(tenant, "subscriptions")
  const t = await getTranslations("farm.plans")
  const data = await loadPlanFormData(tenant, await getLocale())
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("newTitle")}</h1>
      <PlanForm data={data} />
    </div>
  )
}
