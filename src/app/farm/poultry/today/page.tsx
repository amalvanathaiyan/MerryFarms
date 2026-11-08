import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { batchStatus, onFarm } from "@/domain/batches"
import { istDate } from "@/domain/ist"
import { asDay, asInfo, asLoss, loadBatches } from "@/server/batches"
import { SectionHeader } from "@/components/farm/section-header"
import { AllBatchesDay, type DayBatch } from "@/components/farm/all-batches-day"

const ymd = /^\d{4}-\d{2}-\d{2}$/

/** Poultry care · Enter today: one screen for every batch on the farm that day. */
export default async function EnterTodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams
  const { tenant } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "poultryCare")
  const locale = await getLocale()
  const t = await getTranslations("farm.dayAll")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const date = sp.date && ymd.test(sp.date) && sp.date <= today ? sp.date : today

  const { batches, days, losses } = await loadBatches(tenant.id)
  const dayRows = days.map(asDay)
  const lossRows = losses.map(asLoss)
  const live = batches.filter((b) => onFarm(b, date)).sort((a, b) => a.number - b.number)
  const rows: DayBatch[] = live.map((b) => {
    const d = days.find((x) => x.batchId === b.id && x.date === date)
    const l = losses.filter((x) => x.batchId === b.id && x.date === date)
    const last = [...days].reverse().find((x) => x.batchId === b.id && x.date < date && (x.feedKg ?? 0) > 0)
    return {
      id: b.id,
      name: b.name,
      number: b.number,
      // Birds at the start of the day: everything up to the day before.
      alive: batchStatus(asInfo(b), dayRows.filter((x) => x.date < date), lossRows.filter((x) => x.date < date), date).alive,
      showEggs: b.purpose !== "meat" || days.some((x) => x.batchId === b.id && (x.eggsCollected ?? 0) > 0),
      entry: d || l.length ? { feedKg: d?.feedKg ?? null, eggsCollected: d?.eggsCollected ?? null, eggsBroken: d?.eggsBroken ?? null, sold: d?.sold ?? 0, soldPaise: d?.soldPaise ?? 0, given: d?.given ?? 0, note: d?.note ?? null, losses: l.map((x) => ({ cause: x.cause, count: x.count })) } : null,
      lastFeedKg: last?.feedKg ?? null,
    }
  })
  const minDate = batches.map((b) => b.startDate).sort()[0] ?? today

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="poultry" back={{ href: "/farm/poultry", label: t("backToBatches") }} title={date === today ? t("title") : t("titleDay", { day: dayLabel(date, locale, labels) })} hint={t("hint")} />
      <AllBatchesDay key={date} date={date} today={today} minDate={minDate} batches={rows} />
    </div>
  )
}
