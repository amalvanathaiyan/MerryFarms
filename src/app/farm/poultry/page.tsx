import { getLocale, getTranslations } from "next-intl/server"
import { weighDue } from "@/domain/weights"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { poultryTabs } from "@/lib/farm-sections"
import { hatchDate, onFarm } from "@/domain/batches"
import { dosesDue } from "@/domain/vaccinations"
import { istDate } from "@/domain/ist"
import { batchBook } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { BatchesSection, type BatchCard } from "@/components/farm/batches-section"

const ymd = /^\d{4}-\d{2}-\d{2}$/

/** Poultry care · Batches: every batch on the farm today, or on any past day. */
export default async function PoultryPage({ searchParams }: { searchParams: Promise<{ on?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const asOf = sp.on && ymd.test(sp.on) && sp.on < today ? sp.on : today

  const [book, doses, weighings] = await Promise.all([
    batchBook(tenant.id, asOf),
    db.batchVaccination.findMany({ where: { givenDate: null, dueDate: { lte: today } } }),
    db.batchWeight.findMany({ where: { date: { lte: today } }, select: { batchId: true, date: true, birds: true, totalGrams: true } }),
  ])
  const due = dosesDue(
    doses,
    book.rows.map((r) => r.batch),
    today
  )
  const card = ({ batch, status }: (typeof book.rows)[number]): BatchCard => ({
    id: batch.id,
    number: batch.number,
    name: batch.name,
    breed: batch.breed,
    purpose: batch.purpose,
    source: batch.source,
    startCount: batch.startCount,
    startDayText: dayLabel(batch.startDate, locale, labels),
    hatchDayText: dayLabel(hatchDate(batch), locale, labels),
    status,
    vaccinesDue: due.filter((d) => d.batchId === batch.id).map((d) => d.vaccine),
    weighDue: weighDue(batch, weighings.filter((w) => w.batchId === batch.id), today).due,
    enteredToday: book.days.some((d) => d.batchId === batch.id && d.date === today) || book.losses.some((l) => l.batchId === batch.id && l.date === today),
  })

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" tabs={poultryTabs({ roles: staff.roles, features: featuresOf(tenant) })} active="batches" />
      <BatchesSection
        cards={book.rows.filter((r) => onFarm(r.batch, asOf)).map(card)}
        closed={book.rows.filter((r) => r.batch.closedDate && r.batch.closedDate < asOf).map(card)}
        asOf={asOf}
        asOfText={dayLabel(asOf, locale, labels)}
        isToday={asOf === today}
        today={today}
        canManage={staff.roles.includes("owner")}
      />
    </div>
  )
}
