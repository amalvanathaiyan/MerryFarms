"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRightLeft, CheckCircle2, ChevronRight, Egg, Save, TriangleAlert, Wheat } from "lucide-react"
import { EntryBlock } from "./entry-block"
import { saveAllBatchDaysAction } from "@/app/actions/batches"
import { LOSS_CAUSES } from "@/domain/batches"
import { NumberStepper } from "./number-stepper"
import { cn } from "@/lib/utils"

export interface DayBatch {
  id: string
  name: string
  number: number
  alive: number
  showEggs: boolean
  /** What was saved for this day, if anything. */
  entry: {
    feedKg: number | null
    eggsCollected: number | null
    eggsBroken: number | null
    sold: number
    soldPaise: number
    given: number
    note: string | null
    losses: { cause: string; count: number }[]
  } | null
  /** Feed given on the last day entered before this one. */
  lastFeedKg: number | null
}

type Row = { feed: string; eggs: string; broken: string; sold: string; soldFor: string; given: string; losses: Record<string, string>; openLost: boolean; openSold: boolean; touched: boolean }

const s = (v: number | null | undefined) => (v == null || v === 0 ? "" : String(v))
const n = (v: string) => (v.trim() === "" ? null : Number(v))

function startRow(b: DayBatch): Row {
  const e = b.entry
  const losses = Object.fromEntries(LOSS_CAUSES.map((c) => [c, s(e?.losses.find((l) => l.cause === c)?.count)]))
  return {
    feed: s(e?.feedKg),
    eggs: s(e?.eggsCollected),
    broken: s(e?.eggsBroken),
    sold: s(e?.sold),
    soldFor: e?.soldPaise ? String(e.soldPaise / 100) : "",
    given: s(e?.given),
    losses,
    openLost: Object.values(losses).some(Boolean),
    openSold: !!(e?.sold || e?.given),
    touched: false,
  }
}

/**
 * "Enter today" for every batch on one screen: feed and eggs with big − / + buttons and "same as last time",
 * losses, broken eggs and sales only when asked for. One Save for all; untouched batches are left alone.
 */
export function AllBatchesDay({ date, today, minDate, batches }: { date: string; today: string; minDate: string; batches: DayBatch[] }) {
  const t = useTranslations("farm.dayAll")
  const tb = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(batches.map((b) => [b.id, startRow(b)])))
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
  const toSave = batches.filter((b) => rows[b.id].touched)

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 font-semibold">
        {t("day")}
        <input
          type="date"
          min={minDate}
          max={today}
          value={date}
          onChange={(e) => e.target.value && router.push(e.target.value === today ? "/farm/poultry/today" : `/farm/poultry/today?date=${e.target.value}`)}
          className="h-11 rounded-xl border-2 border-input bg-background px-2 font-normal"
        />
      </label>

      {batches.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("none")}</p>}

      {batches.map((b) => {
        const r = rows[b.id]
        const res = results[b.id]
        const lostCount = Object.values(r.losses).reduce((a, v) => a + (Number(v) || 0), 0)
        return (
          <section key={b.id} className={cn("flex flex-col gap-3 rounded-2xl border-2 bg-card p-4", res?.ok ? "border-primary/50" : res ? "border-destructive/50" : "border-border")}>
            {/* A thin, light bar pinned under the app header while this batch is on screen, so the numbers below
                always say which batch they're for. */}
            <div className="sticky z-10 -mx-4 -mt-4 flex items-center justify-between gap-2 rounded-t-2xl border-b bg-sec-poultry-tint/95 px-4 py-2 backdrop-blur" style={{ top: "var(--app-header-h, 66px)" }}>
              <Link href={`/farm/poultry/batches/${b.id}`} className="line-clamp-2 min-w-0 leading-snug">
                <span className="font-bold">{b.name}</span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  · {tb("batchNo", { number: b.number })} · {t("birdsShort", { count: b.alive })}
                </span>
              </Link>
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

            <EntryBlock icon={Wheat} title={t("blockFeed")}>
              <NumberStepper label={t("feedKgGiven")} value={r.feed} onChange={(v) => edit(b.id, { feed: v })} decimal />
              {b.lastFeedKg != null && r.feed !== String(b.lastFeedKg) && (
                <button type="button" onClick={() => edit(b.id, { feed: String(b.lastFeedKg) })} className="self-start rounded-full border-2 border-dashed border-primary px-3 py-1 text-sm font-semibold text-primary">
                  {t("sameAsLast", { kg: b.lastFeedKg })}
                </button>
              )}
            </EntryBlock>

            {b.showEggs && (
              <EntryBlock icon={Egg} title={t("blockEggs")}>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <NumberStepper size="sm" label={t("eggsGot")} value={r.eggs} onChange={(v) => edit(b.id, { eggs: v })} />
                  <NumberStepper size="sm" label={t("eggsBrokenShort")} value={r.broken} onChange={(v) => edit(b.id, { broken: v })} />
                </div>
              </EntryBlock>
            )}

            <EntryBlock
              icon={TriangleAlert}
              title={t("blockLost")}
              tone={lostCount > 0 ? "bad" : undefined}
              summary={lostCount > 0 ? t("lostCount", { count: lostCount }) : t("noneTapToAdd")}
              open={r.openLost}
              onToggle={() => setRows((x) => ({ ...x, [b.id]: { ...r, openLost: !r.openLost } }))}
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {LOSS_CAUSES.map((c) => (
                  <NumberStepper key={c} size="sm" label={tb(`cause_${c}`)} value={r.losses[c]} onChange={(v) => edit(b.id, { losses: { ...r.losses, [c]: v } })} />
                ))}
              </div>
            </EntryBlock>

            <EntryBlock
              icon={ArrowRightLeft}
              title={t("blockOut")}
              summary={(Number(r.sold) || 0) + (Number(r.given) || 0) > 0 ? t("outSummary", { sold: Number(r.sold) || 0, given: Number(r.given) || 0 }) : t("noneTapToAdd")}
              open={r.openSold}
              onToggle={() => setRows((x) => ({ ...x, [b.id]: { ...r, openSold: !r.openSold } }))}
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <NumberStepper size="sm" label={tb("sold")} value={r.sold} onChange={(v) => edit(b.id, { sold: v })} />
                <NumberStepper size="sm" label={tb("given")} value={r.given} onChange={(v) => edit(b.id, { given: v })} />
              </div>
              <p className="text-xs text-muted-foreground">{t("outHint")}</p>
            </EntryBlock>

            <Link href={`/farm/poultry/batches/${b.id}`} className="flex items-center gap-1 self-end text-sm font-semibold text-primary">
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
                  rows: toSave.map((b) => {
                    const r = rows[b.id]
                    return {
                      batchId: b.id,
                      feedKg: n(r.feed),
                      eggsCollected: b.showEggs ? n(r.eggs) : null,
                      eggsBroken: b.showEggs ? n(r.broken) : null,
                      sold: n(r.sold) ?? 0,
                      soldRupees: n(r.soldFor) ?? 0,
                      given: n(r.given) ?? 0,
                      // The note is changed on the batch's own page; keep it as it was.
                      note: b.entry?.note ?? undefined,
                      losses: LOSS_CAUSES.map((cause) => ({ cause, count: n(r.losses[cause]) ?? 0 })).filter((l) => l.count > 0),
                    }
                  }),
                })
                if (!res.ok) return setError(te.has(res.error) ? te(res.error) : te("generic"))
                setResults(Object.fromEntries(res.results.map((x) => [x.batchId, x])))
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
