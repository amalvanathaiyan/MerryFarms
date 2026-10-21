import { getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { SlotManager } from "@/components/farm/slot-manager"

export default async function SlotsPage() {
  const { db, staff } = await requireStaff()
  const t = await getTranslations("farm.slots")
  const slots = await db.deliverySlot.findMany({ orderBy: { startTime: "asc" } })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <SlotManager
        canEdit={staff.roles.includes("owner")}
        slots={slots.map(({ id, nameTa, nameEn, startTime, endTime, daysOfWeek, cutoffHours, maxOrders, isActive }) => ({
          id,
          nameTa,
          nameEn,
          startTime,
          endTime,
          daysOfWeek,
          cutoffHours,
          maxOrders,
          isActive,
        }))}
      />
    </div>
  )
}
