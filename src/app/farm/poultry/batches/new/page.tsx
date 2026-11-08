import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { istDate } from "@/domain/ist"
import { BatchForm } from "@/components/farm/batch-form"
import { SectionHeader } from "@/components/farm/section-header"

/** Owner: a new batch of birds, bought in or hatched here. */
export default async function NewBatchPage() {
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "poultryCare")
  const t = await getTranslations("farm.batches")
  const today = istDate(new Date())
  const parents = await db.batch.findMany({ orderBy: { number: "desc" }, select: { id: true, name: true, number: true } })

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" back={{ href: "/farm/poultry", label: t("backToPoultry") }} title={t("newTitle")} hint={t("newHint")} />
      <BatchForm
        today={today}
        parents={parents.map((p) => ({ id: p.id, name: `${p.name} · #${p.number}` }))}
        initial={{ name: "", breed: "", purpose: "eggs", source: "bought", supplier: "", startDate: today, ageAtStartDays: "1", startCount: "", eggsSet: "", parentBatchId: "", eggValueRupees: "", note: "" }}
      />
    </div>
  )
}
