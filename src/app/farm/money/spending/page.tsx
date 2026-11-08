import { getLocale, getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { moneyTabs } from "@/lib/farm-sections"
import { onFarm } from "@/domain/batches"
import { istDate } from "@/domain/ist"
import { SectionHeader } from "@/components/farm/section-header"
import { RecordsManager } from "@/components/farm/records-manager"

/** Money · Spending (owner): add what the farm spends; this month's list and total. */
export default async function MoneySpendingPage() {
  const { db, tenant, staff } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "farmRecords")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())

  const [expenses, batches] = await Promise.all([
    db.expense.findMany({ where: { date: { gte: `${today.slice(0, 8)}01` } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    features.poultryCare ? db.batch.findMany({ orderBy: { number: "desc" } }) : Promise.resolve([]),
  ])
  const batchName = (id: string | null) => {
    const b = id ? batches.find((x) => x.id === id) : null
    return b ? `${b.name} · #${b.number}` : null
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="money" tabs={moneyTabs({ roles: staff.roles, features })} active="spending" />
      <RecordsManager
        today={today}
        canSpend
        poultry={features.poultryCare}
        batches={null}
        production={null}
        batchOptions={batches.filter((b) => onFarm(b, today)).map((b) => ({ id: b.id, name: `${b.name} · #${b.number}` }))}
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
