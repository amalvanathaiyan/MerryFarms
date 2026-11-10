"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveBatchDayAction } from "@/app/actions/batches"
import { LOSS_CAUSES } from "@/domain/batches"
import { NumberStepper } from "./number-stepper"
import { EntryBlock } from "./entry-block"
import { ArrowRightLeft, Egg, TriangleAlert, Wheat } from "lucide-react"
import { useCheer } from "@/components/cheer"
import { dayCheer } from "@/domain/cheers"

export interface DayEntry {
  date: string
  feedKg: number | null
  eggsCollected: number | null
  eggsBroken: number | null
  sold: number
  soldPaise: number
  given: number
  note: string | null
  losses: { cause: string; count: number }[]
}

const num = (v: string) => (v.trim() === "" ? null : Number(v))
const str = (v: number | null | undefined) => (v == null || v === 0 ? "" : String(v))

function valuesFor(date: string, entries: DayEntry[]) {
  const e = entries.find((x) => x.date === date)
  return {
    feedKg: str(e?.feedKg),
    eggsCollected: str(e?.eggsCollected),
    eggsBroken: str(e?.eggsBroken),
    sold: str(e?.sold),
    soldRupees: e?.soldPaise ? String(e.soldPaise / 100) : "",
    given: str(e?.given),
    note: e?.note ?? "",
    losses: Object.fromEntries(LOSS_CAUSES.map((c) => [c, str(e?.losses.find((l) => l.cause === c)?.count)])) as Record<string, string>,
  }
}

/** One day of one batch: feed, eggs, birds lost (by cause), sold or given. Keyed by date by its parent, so a new day starts fresh. */
export function BatchDayForm({
  batchId,
  batchName,
  minDate,
  maxDate,
  date,
  onDate,
  showEggs,
  entries,
}: {
  batchId: string
  /** For the notice after saving. */
  batchName: string
  minDate: string
  maxDate: string
  date: string
  onDate: (date: string) => void
  showEggs: boolean
  entries: DayEntry[]
}) {
  const t = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [v, setV] = useState(() => valuesFor(date, entries))
  const existing = entries.some((e) => e.date === date)
  // Feed from the last day entered before this one, for "Same as last time".
  const lastFeed = [...entries].filter((e) => e.date < date && (e.feedKg ?? 0) > 0).sort((a, b) => b.date.localeCompare(a.date))[0]?.feedKg ?? null
  const td = useTranslations("farm.dayAll")

  const edit = (patch: Partial<typeof v>) => (setSaved(false), setV({ ...v, ...patch }))
  const lostCount = Object.values(v.losses).reduce((a, x) => a + (Number(x) || 0), 0)
  const outCount = (Number(v.sold) || 0) + (Number(v.given) || 0)
  const [openLost, setOpenLost] = useState(() => lostCount > 0)
  const [openOut, setOpenOut] = useState(() => outCount > 0)
  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          setSaved(false)
          const r = await saveBatchDayAction(batchId, {
            date,
            feedKg: num(v.feedKg),
            eggsCollected: showEggs ? num(v.eggsCollected) : null,
            eggsBroken: showEggs ? num(v.eggsBroken) : null,
            sold: num(v.sold) ?? 0,
            soldRupees: num(v.soldRupees) ?? 0,
            given: num(v.given) ?? 0,
            note: v.note || undefined,
            losses: LOSS_CAUSES.map((cause) => ({ cause, count: num(v.losses[cause]) ?? 0 })).filter((l) => l.count > 0),
          })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          setSaved(true)
          const c = dayCheer([{ name: batchName, eggs: showEggs ? num(v.eggsCollected) : null, lost: lostCount }])
          cheer(c.kind, c.values)
        })
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{existing ? t("dayChange") : t("dayEnter")}</h2>
        <Input type="date" min={minDate} max={maxDate} value={date} onChange={(e) => e.target.value && onDate(e.target.value)} className="h-10 w-auto" aria-label={t("dayDate")} />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <EntryBlock icon={Wheat} title={td("blockFeed")}>
        <NumberStepper label={td("feedKgGiven")} value={v.feedKg} onChange={(s) => edit({ feedKg: s })} decimal />
        {lastFeed != null && v.feedKg !== String(lastFeed) && (
          <button type="button" onClick={() => edit({ feedKg: String(lastFeed) })} className="self-start rounded-full border-2 border-dashed border-primary px-3 py-1 text-sm font-semibold text-primary">
            {td("sameAsLast", { kg: lastFeed })}
          </button>
        )}
      </EntryBlock>

      {showEggs && (
        <EntryBlock icon={Egg} title={td("blockEggs")}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberStepper size="sm" label={td("eggsGot")} value={v.eggsCollected} onChange={(s) => edit({ eggsCollected: s })} />
            <NumberStepper size="sm" label={td("eggsBrokenShort")} value={v.eggsBroken} onChange={(s) => edit({ eggsBroken: s })} />
          </div>
        </EntryBlock>
      )}

      <EntryBlock
        icon={TriangleAlert}
        title={td("blockLost")}
        tone={lostCount > 0 ? "bad" : undefined}
        summary={lostCount > 0 ? td("lostCount", { count: lostCount }) : td("noneTapToAdd")}
        open={openLost}
        onToggle={() => setOpenLost(!openLost)}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {LOSS_CAUSES.map((c) => (
            <NumberStepper key={c} size="sm" label={t(`cause_${c}`)} value={v.losses[c]} onChange={(s) => edit({ losses: { ...v.losses, [c]: s } })} />
          ))}
        </div>
      </EntryBlock>

      <EntryBlock
        icon={ArrowRightLeft}
        title={td("blockOut")}
        summary={outCount > 0 ? td("outSummary", { sold: Number(v.sold) || 0, given: Number(v.given) || 0 }) : td("noneTapToAdd")}
        open={openOut}
        onToggle={() => setOpenOut(!openOut)}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberStepper size="sm" label={t("sold")} value={v.sold} onChange={(s) => edit({ sold: s })} />
          <NumberStepper size="sm" label={t("given")} value={v.given} onChange={(s) => edit({ given: s })} />
        </div>
        <p className="text-xs text-muted-foreground">{td("outHint")}</p>
      </EntryBlock>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("note")}
        <Input value={v.note} maxLength={200} onChange={(e) => edit({ note: e.target.value })} placeholder={t("notePlaceholder")} className="font-normal" />
      </label>

      <Button type="submit" size="lg" disabled={pending}>
        {saved ? `✓ ${t("saved")}` : t("saveDay")}
      </Button>
    </form>
  )
}
