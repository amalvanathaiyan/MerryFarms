import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { moneyTabs } from "@/lib/farm-sections"
import { onFarm } from "@/domain/batches"
import { addDays, addMonths, istDate } from "@/domain/ist"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/farm/section-header"
import { RecordsManager } from "@/components/farm/records-manager"

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/** Money · Spending (owner): add what the farm spends, and see what was paid out in any month. */
export default async function MoneySpendingPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams
  const { db, tenant, staff } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "farmRecords")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.records")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const thisMonth = today.slice(0, 7)
  const month = sp.month && MONTH.test(sp.month) && sp.month <= thisMonth ? sp.month : thisMonth
  const from = `${month}-01`
  const to = addDays(addMonths(from, 1), -1)
  const prev = addMonths(from, -1).slice(0, 7)
  const next = addMonths(from, 1).slice(0, 7)
  const monthName = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${from}T00:00:00Z`))

  const [expenses, batches] = await Promise.all([
    db.expense.findMany({ where: { date: { gte: from, lte: to } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    features.poultryCare ? db.batch.findMany({ orderBy: { number: "desc" } }) : Promise.resolve([]),
  ])
  const batchName = (id: string | null) => {
    const b = id ? batches.find((x) => x.id === id) : null
    return b ? `${b.name} · #${b.number}` : null
  }
  const monthLink = (m: string) => (m === thisMonth ? "/farm/money/spending" : `/farm/money/spending?month=${m}`)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="money" tabs={moneyTabs({ roles: staff.roles, features })} active="spending" />
      <RecordsManager
        today={today}
        canSpend
        poultry={features.poultryCare}
        batches={null}
        production={null}
        periodLabel={month === thisMonth ? t("thisMonth") : monthName}
        batchOptions={batches.filter((b) => onFarm(b, today)).map((b) => ({ id: b.id, name: `${b.name} · #${b.number}` }))}
        expenses={expenses.map((e) => ({
          id: e.id,
          dayText: dayLabel(e.date, locale, labels),
          kind: e.kind,
          amountPaise: e.amountPaise,
          quantityKg: e.quantityKg,
          batchName: batchName(e.batchId),
          spreadMonths: e.spreadMonths,
          note: e.note,
        }))}
        footer={
          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Link href={monthLink(prev)} className="flex h-11 items-center justify-center gap-1 rounded-xl border-2 bg-card font-semibold hover:bg-accent">
                <ChevronLeft className="size-5" aria-hidden /> {t("prevMonth")}
              </Link>
              <span className="px-1 text-center font-bold">{monthName}</span>
              {month < thisMonth ? (
                <Link href={monthLink(next)} className="flex h-11 items-center justify-center gap-1 rounded-xl border-2 bg-card font-semibold hover:bg-accent">
                  {t("nextMonth")} <ChevronRight className="size-5" aria-hidden />
                </Link>
              ) : (
                <span />
              )}
            </div>
            <form action="/farm/money/spending" className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
                {t("pickMonth")}
                <Input type="month" name="month" max={thisMonth} defaultValue={month} className="h-11 font-normal" />
              </label>
              <Button type="submit" variant="outline" className="h-11">
                {t("showMonth")}
              </Button>
            </form>
            <Button asChild variant="outline" className="h-12 justify-start text-base">
              <a href={`/farm/reports/export?type=expenses&from=${from}&to=${to}`}>
                <Download /> {t("downloadMonth", { month: monthName })}
              </a>
            </Button>
          </div>
        }
      />
    </div>
  )
}
