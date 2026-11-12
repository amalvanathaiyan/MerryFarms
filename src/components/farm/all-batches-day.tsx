"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2, ChevronRight, Save } from "lucide-react"
import { saveAllBatchDaysAction } from "@/app/actions/batches"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"
import { dayCheer } from "@/domain/cheers"
import { DayFields, dayPayload, dayValues, lostTotal, numOrNull, type DayValues, type SavedDay } from "./day-fields"

export interface DayBatch {
  id: string
  name: string
  number: number
  alive: number
  showEggs: boolean
  /** What was saved for this day, if anything. */
  entry: SavedDay | null
  /** Feed given on the last day entered before this one. */
  lastFeedKg: number | null
}

type Row = DayValues & { touched: boolean }

/**
 * Entry · All batches: the day's feed, eggs, losses and sales for every batch on one screen. One Save for all;
 * untouched batches are left alone. Weighings and vaccines are entered one batch at a time.
 */
export function AllBatchesDay({ date, batches }: { date: string; batches: DayBatch[] }) {
  const t = useTranslations("farm.dayAll")
  const tb = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(batches.map((b) => [b.id, { ...dayValues(b.entry), touched: false }])))
  const [results, setResults] = useState<Record<string, { ok: boolean; error?: string }>>({})
  const [error, setError] = useState<string | null>(null)

  const edit = (id: string, patch: Partial<Row>) => {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch, touched: true } }))
    setResults((r) => {
      const next = { ...r }
      delete next[id]
      return next
    })
  }
  const fold = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  const toSave = batches.filter((b) => rows[b.id].touched)

  return (
    <div className="flex flex-col gap-3">
      {batches.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("none")}</p>}

      {batches.map((b) => {
        const r = rows[b.id]
        const res = results[b.id]
        return (
          <section key={b.id} className={cn("flex flex-col gap-3 rounded-2xl border-2 bg-card p-4", res?.ok ? "border-primary/50" : res ? "border-destructive/50" : "border-border")}>
            {/* A thin, light bar pinned under the app header while this batch is on screen, so the numbers below
                always say which batch they're for. */}
            <div className="sticky z-10 -mx-4 -mt-4 flex items-center justify-between gap-2 rounded-t-2xl border-b bg-card/95 px-4 py-2 backdrop-blur" style={{ top: "var(--app-header-h, 66px)" }}>
              <span className="line-clamp-2 min-w-0 leading-snug">
                <span className="font-bold">{b.name}</span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  · {tb("batchNo", { number: b.number })} · {t("birdsShort", { count: b.alive })}
                </span>
              </span>
              {res?.ok ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-primary">
                  <CheckCircle2 className="size-4" aria-hidden /> {t("saved")}
                </span>
              ) : b.entry && !r.touched ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">{t("alreadyEntered")}</span>
              ) : null}
            </div>
            {res && !res.ok && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {res.error && te.has(res.error) ? te(res.error) : te("generic")}
              </p>
            )}

            <DayFields v={r} onEdit={(p) => edit(b.id, p)} onFold={(p) => fold(b.id, p)} showEggs={b.showEggs} lastFeedKg={b.lastFeedKg} />

            <Link href={`/farm/poultry/entry?batch=${b.id}&date=${date}`} className="flex items-center gap-1 self-end text-sm font-semibold text-primary">
              {t("moreOnBatch")} <ChevronRight className="size-4" aria-hidden />
            </Link>
          </section>
        )
      })}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {batches.length > 0 && (
        <div className="sticky bottom-24 z-10 lg:bottom-4">
          <button
            type="button"
            disabled={pending || toSave.length === 0}
            onClick={() =>
              start(async () => {
                setError(null)
                const res = await saveAllBatchDaysAction({
                  date,
                  // The note is changed when entering one batch; keep it as it was.
                  rows: toSave.map((b) => ({ batchId: b.id, ...dayPayload(rows[b.id], b.showEggs, b.entry) })),
                })
                if (!res.ok) return setError(te.has(res.error) ? te(res.error) : te("generic"))
                setResults(Object.fromEntries(res.results.map((x) => [x.batchId, x])))
                const done = res.results
                  .filter((x) => x.ok)
                  .map((x) => {
                    const b = batches.find((y) => y.id === x.batchId)
                    const r = rows[x.batchId]
                    return { name: b?.name ?? "", eggs: b?.showEggs ? numOrNull(r.eggs) : null, lost: lostTotal(r) }
                  })
                if (done.length) {
                  const c = dayCheer(done)
                  cheer(c.kind, c.values)
                }
                setRows((all) => {
                  const next = { ...all }
                  for (const x of res.results) if (x.ok) next[x.batchId] = { ...next[x.batchId], touched: false }
                  return next
                })
              })
            }
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sec-poultry text-lg font-bold text-sec-on shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            <Save className="size-5" aria-hidden />
            {pending ? t("saving") : toSave.length > 0 ? t("saveCount", { count: toSave.length }) : Object.values(results).some((x) => x.ok) ? `✓ ${t("allSaved")}` : t("save")}
          </button>
        </div>
      )}
    </div>
  )
}
