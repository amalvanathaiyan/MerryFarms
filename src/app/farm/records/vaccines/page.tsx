import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { loadSchedule } from "@/server/vaccinations"
import { VaccineSchedule } from "@/components/farm/vaccine-schedule"

/** Owner: the farm's vaccine plan, by age. */
export default async function VaccinePlanPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "poultryCare")
  const t = await getTranslations("farm.vaccines")
  const tb = await getTranslations("farm.batches")
  const items = await loadSchedule(tenant.id)

  return (
    <div className="flex flex-col gap-4">
      <Link href="/farm/records" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        ← {tb("backToRecords")}
      </Link>
      <div>
        <h1 className="text-xl font-bold">{t("planTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("planHint")}</p>
      </div>
      <VaccineSchedule items={items.map((i) => ({ id: i.id, vaccine: i.vaccine, ageDays: i.ageDays, method: i.method }))} />
    </div>
  )
}
