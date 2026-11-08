import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { istDate } from "@/domain/ist"
import { BatchForm } from "@/components/farm/batch-form"
import { SectionHeader } from "@/components/farm/section-header"

const s = (v: number | null) => (v == null ? "" : String(v))

/** Owner: change a batch's details. */
export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "poultryCare")
  const t = await getTranslations("farm.batches")
  const batch = await db.batch.findFirst({ where: { id } })
  if (!batch) notFound()
  const parents = await db.batch.findMany({ where: { id: { not: id } }, orderBy: { number: "desc" }, select: { id: true, name: true, number: true } })

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" back={{ href: `/farm/poultry/batches/${id}`, label: `${batch.name} · ${t("batchNo", { number: batch.number })}` }} title={t("editTitle")} hint={null} />
      <BatchForm
        id={id}
        today={istDate(new Date())}
        parents={parents.map((p) => ({ id: p.id, name: `${p.name} · #${p.number}` }))}
        initial={{
          name: batch.name,
          breed: batch.breed ?? "",
          purpose: batch.purpose,
          source: batch.source,
          supplier: batch.supplier ?? "",
          startDate: batch.startDate,
          ageAtStartDays: String(batch.ageAtStartDays),
          startCount: String(batch.startCount),
          eggsSet: s(batch.eggsSet),
          parentBatchId: batch.parentBatchId ?? "",
          eggValueRupees: batch.eggValuePaise == null ? "" : String(batch.eggValuePaise / 100),
          note: batch.note ?? "",
        }}
      />
    </div>
  )
}
