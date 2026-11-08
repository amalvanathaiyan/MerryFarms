import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { hatchDate, onFarm } from "@/domain/batches"
import { ProductionSection } from "@/components/farm/production-section"
import { BatchesSection, type BatchCard } from "@/components/farm/batches-section"
import { addDays, istDate } from "@/domain/ist"
import { RecordsManager } from "@/components/farm/records-manager"
import { batchBook } from "@/server/batches"
import { dosesDue } from "@/domain/vaccinations"

const ymd = /^\d{4}-\d{2}-\d{2}$/

/** Farm records: what was made, each batch of birds (as of any day), and what the farm spends. */
export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ on?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "farmRecords")
  const locale = await getLocale()
  const t = await getTranslations("farm.records")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const asOf = sp.on && ymd.test(sp.on) && sp.on < today ? sp.on : today
  const isOwner = staff.roles.includes("owner")
  const features = featuresOf(tenant)
  const poultry = features.poultryCare

  const since = addDays(today, -13)
  const [book, expenses, products, entries, doses] = await Promise.all([
    poultry ? batchBook(tenant.id, asOf) : Promise.resolve({ rows: [], days: [], losses: [], feed: null, notes: [] }),
    isOwner ? db.expense.findMany({ where: { date: { gte: `${today.slice(0, 8)}01` } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }) : Promise.resolve([]),
    db.product.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.productionEntry.findMany({ where: { date: { gte: since } } }),
    poultry ? db.batchVaccination.findMany({ where: { givenDate: null, dueDate: { lte: today } } }) : Promise.resolve([]),
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
    enteredToday: book.days.some((d) => d.batchId === batch.id && d.date === today) || book.losses.some((l) => l.batchId === batch.id && l.date === today),
  })
  const cards = book.rows.filter((r) => onFarm(r.batch, asOf)).map(card)
  const closed = book.rows.filter((r) => r.batch.closedDate && r.batch.closedDate < asOf).map(card)
  const batchName = (id: string | null) => {
    const b = id ? book.rows.find((r) => r.batch.id === id)?.batch : null
    return b ? `${b.name} · #${b.number}` : null
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <RecordsManager
        today={today}
        canSpend={isOwner}
        batches={
          poultry ? (
            <BatchesSection
              cards={cards}
              closed={closed}
              asOf={asOf}
              asOfText={dayLabel(asOf, locale, labels)}
              isToday={asOf === today}
              today={today}
              canManage={isOwner}
              feed={isOwner ? book.feed : null}
            />
          ) : null
        }
        poultry={poultry}
        batchOptions={book.rows.filter((r) => onFarm(r.batch, today)).map((r) => ({ id: r.batch.id, name: `${r.batch.name} · #${r.batch.number}` }))}
        production={
          <ProductionSection
            today={today}
            toStock={features.stockTracking}
            products={products.map((p) => ({ id: p.id, name: pick(locale, p.nameTa, p.nameEn), pack: pick(locale, p.packTa, p.packEn), unit: p.stockUnit }))}
            entries={entries.map((e) => ({ date: e.date, productId: e.productId, made: e.made, wasted: e.wasted }))}
          />
        }
        expenses={expenses.map((e) => ({
          id: e.id,
          dayText: dayLabel(e.date, locale, labels),
          kind: e.kind,
          amountPaise: e.amountPaise,
          quantityKg: e.quantityKg,
          batchName: batchName(e.batchId),
          note: e.note,
        }))}
      />
    </div>
  )
}
