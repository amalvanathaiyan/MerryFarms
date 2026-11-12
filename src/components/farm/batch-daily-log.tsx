import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LogRow {
  date: string
  dayText: string
  feedKg: number | null
  eggsCollected: number | null
  eggsBroken: number | null
  sold: number
  given: number
  lost: number
  aliveAfter: number
  note: string | null
}

/**
 * A batch's daily log, newest first: birds alive, lost, sold or given, feed and eggs each day. With `entryHref`, a
 * day opens on the Entry page to be changed.
 */
export async function BatchDailyLog({ rows, showEggs, entryHref }: { rows: LogRow[]; showEggs: boolean; entryHref: ((date: string) => string) | null }) {
  const t = await getTranslations("farm.batches")
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const cell = (r: LogRow, children: React.ReactNode, className?: string) => (
    <td className={className}>
      {entryHref ? (
        <Link href={entryHref(r.date)} className="block py-1.5" tabIndex={-1}>
          {children}
        </Link>
      ) : (
        <span className="block py-1.5">{children}</span>
      )}
    </td>
  )
  return (
    <section id="daily" className="flex scroll-mt-32 flex-col gap-2 rounded-2xl border bg-card p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sec-poultry">
          <ClipboardList className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-bold">{t("history")}</h2>
          {entryHref && sorted.length > 0 && <p className="text-sm text-muted-foreground">{t("historyHint")}</p>}
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("historyNone")}</p>
      ) : (
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
              {sorted.map((r) => (
                <tr key={r.date} className={cn(entryHref && "hover:bg-accent/40")}>
                  <td className="pr-2">
                    {entryHref ? (
                      <Link href={entryHref(r.date)} className="block py-1.5 font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline">
                        {r.dayText}
                      </Link>
                    ) : (
                      <span className="block py-1.5 whitespace-nowrap">{r.dayText}</span>
                    )}
                    {r.note && <span className="block pb-1.5 text-xs text-muted-foreground">{r.note}</span>}
                  </td>
                  {cell(r, r.aliveAfter, "px-2 text-right font-semibold")}
                  {cell(r, r.lost || "—", cn("px-2 text-right", r.lost > 0 && "font-semibold text-destructive"))}
                  {cell(r, r.sold + r.given || "—", "px-2 text-right")}
                  {cell(r, r.feedKg ?? "—", "px-2 text-right")}
                  {showEggs && cell(r, r.eggsCollected ?? "—", "pl-2 text-right")}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
