import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { SlotManager } from "@/components/farm/slot-manager"
import { ClosedDays } from "@/components/farm/closed-days"
import { istDate } from "@/domain/ist"
import { slotRangeLabel } from "@/domain/slots"
import { dayLabel, pick } from "@/lib/i18n-helpers"

export default async function SlotsPage() {
  const { db, staff } = await requireStaff()
  const t = await getTranslations("farm.slots")
  const slots = await db.deliverySlot.findMany({ orderBy: { startTime: "asc" } })
  const locale = await getLocale()
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const closed = await db.closedDay.findMany({ where: { date: { gte: today } }, orderBy: [{ date: "asc" }] })
  const slotLabel = (id: string) => {
    const s = slots.find((x) => x.id === id)
    return s ? `${pick(locale, s.nameTa, s.nameEn)} ${slotRangeLabel(s.startTime, s.endTime)}` : ""
  }
  // Orders already booked on a closed day: the farm moves or cancels them.
  const booked = await db.order.groupBy({
    by: ["slotDate", "slotId"],
    where: { status: { notIn: ["cancelled", "delivered"] }, slotDate: { in: closed.map((c) => c.date) } },
    _count: { _all: true },
  })

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
      <ClosedDays
        canEdit={staff.roles.includes("owner")}
        today={today}
        slots={slots.filter((s) => s.isActive).map((s) => ({ id: s.id, label: slotLabel(s.id) }))}
        rows={closed.map((c) => ({
          id: c.id,
          dayText: dayLabel(c.date, locale, labels),
          slotText: c.slotId ? slotLabel(c.slotId) : null,
          note: c.note,
          booked: booked.filter((b) => b.slotDate === c.date && (!c.slotId || b.slotId === c.slotId)).reduce((a, b) => a + b._count._all, 0),
        }))}
      />
    </div>
  )
}
