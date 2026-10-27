import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { keepsPoultry } from "@/domain/records"
import { ProductionSection } from "@/components/farm/production-section"
import { addDays, istDate } from "@/domain/ist"
import { RecordsManager } from "@/components/farm/records-manager"

/** Farm records: the day's eggs, birds and feed, and what the farm spends. */
export default async function RecordsPage() {
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "farmRecords")
  const locale = await getLocale()
  const t = await getTranslations("farm.records")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const isOwner = staff.roles.includes("owner")

  const since = addDays(today, -13)
  const [records, expenses, products, entries, kinds] = await Promise.all([
    db.dailyRecord.findMany({ where: { date: { gte: since } }, orderBy: { date: "desc" } }),
    isOwner ? db.expense.findMany({ where: { date: { gte: `${today.slice(0, 8)}01` } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }) : Promise.resolve([]),
    db.product.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.productionEntry.findMany({ where: { date: { gte: since } } }),
    db.category.findMany({ where: { deletedAt: null }, select: { kind: true } }),
  ])
  const poultry = keepsPoultry(kinds.map((k) => k.kind), records.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <RecordsManager
        today={today}
        canSpend={isOwner}
        poultry={poultry}
        production={
          <ProductionSection
            today={today}
            toStock={featuresOf(tenant).stockTracking}
            products={products.map((p) => ({ id: p.id, name: pick(locale, p.nameTa, p.nameEn), pack: pick(locale, p.packTa, p.packEn), unit: p.stockUnit }))}
            entries={entries.map((e) => ({ date: e.date, productId: e.productId, made: e.made, wasted: e.wasted }))}
          />
        }
        records={records.map((r) => ({
          date: r.date,
          dayText: dayLabel(r.date, locale, labels),
          eggsCollected: r.eggsCollected,
          eggsBroken: r.eggsBroken,
          birds: r.birds,
          birdsLost: r.birdsLost,
          feedKg: r.feedKg,
          note: r.note,
        }))}
        expenses={expenses.map((e) => ({ id: e.id, dayText: dayLabel(e.date, locale, labels), kind: e.kind, amountPaise: e.amountPaise, note: e.note }))}
      />
    </div>
  )
}
