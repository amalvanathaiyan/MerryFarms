import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { loadSchedule } from "@/server/vaccinations"
import { VaccineSchedule } from "@/components/farm/vaccine-schedule"
import { SectionHeader } from "@/components/farm/section-header"

/** Owner: the farm's vaccine plan, by age. */
export default async function VaccinePlanPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "poultryCare")
  const t = await getTranslations("farm.vaccines")
  const items = await loadSchedule(tenant.id)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" back={{ href: "/farm/poultry/vaccines", label: t("backToVaccines") }} title={t("planTitle")} hint={t("planHint")} />
      <VaccineSchedule items={items.map((i) => ({ id: i.id, vaccine: i.vaccine, ageDays: i.ageDays, method: i.method }))} />
    </div>
  )
}
