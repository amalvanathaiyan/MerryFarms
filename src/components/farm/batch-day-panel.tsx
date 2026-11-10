"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { BatchDayForm, type DayEntry } from "./batch-day-form"
import { cn } from "@/lib/utils"

export type HistoryRow = DayEntry & { dayText: string; lost: number; aliveAfter: number }

/** The day's entry for a batch, and the days already entered: tap one to see or change it. */
export function BatchDayPanel({
  batchId,
  batchName,
  minDate,
  maxDate,
  initialDate,
  showEggs,
  entries,
}: {
  batchId: string
  batchName: string
  minDate: string
  maxDate: string
  initialDate: string
  showEggs: boolean
  entries: HistoryRow[]
}) {
  const t = useTranslations("farm.batches")
  const [date, setDate] = useState(initialDate)
  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)

  return (
    <>
      <BatchDayForm key={date} batchId={batchId} batchName={batchName} minDate={minDate} maxDate={maxDate} date={date} onDate={setDate} showEggs={showEggs} entries={entries} />

      {recent.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 font-semibold">{t("history")}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{t("historyHint")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">{t("dayDate")}</th>
                  <th className="px-2 text-right font-medium">{t("aliveShort")}</th>
                  <th className="px-2 text-right font-medium">{t("lostShort")}</th>
                  <th className="px-2 text-right font-medium">{t("outShort")}</th>
                  <th className="px-2 text-right font-medium">{t("feedShort")}</th>
                  {showEggs && <th className="pl-2 text-right font-medium">{t("eggsShort")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((r) => (
                  <tr key={r.date} className={cn("cursor-pointer hover:bg-accent/40", r.date === date && "bg-accent/60")} onClick={() => (setDate(r.date), window.scrollTo({ top: 0, behavior: "smooth" }))}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{r.dayText}</td>
                    <td className="px-2 text-right font-semibold">{r.aliveAfter}</td>
                    <td className={cn("px-2 text-right", r.lost > 0 && "font-semibold text-destructive")}>{r.lost || "—"}</td>
                    <td className="px-2 text-right">{r.sold + r.given || "—"}</td>
                    <td className="px-2 text-right">{r.feedKg ?? "—"}</td>
                    {showEggs && <td className="pl-2 text-right">{r.eggsCollected ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
