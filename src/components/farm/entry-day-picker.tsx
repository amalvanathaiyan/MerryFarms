"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

/** The Entry page's day: changing it reloads the page for that day, keeping the batch picked. */
export function EntryDayPicker({ date, today, minDate, batch }: { date: string; today: string; minDate: string; batch: string }) {
  const t = useTranslations("farm.entry")
  const router = useRouter()
  return (
    <label className="flex items-center justify-between gap-3 font-semibold">
      {t("day")}
      <input
        type="date"
        min={minDate}
        max={today}
        value={date}
        onChange={(e) => e.target.value && router.push(`/farm/poultry/entry?batch=${batch}${e.target.value === today ? "" : `&date=${e.target.value}`}`)}
        className="h-11 rounded-xl border-2 border-input bg-background px-2 font-normal"
      />
    </label>
  )
}
