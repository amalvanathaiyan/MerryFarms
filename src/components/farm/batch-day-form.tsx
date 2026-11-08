"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveBatchDayAction } from "@/app/actions/batches"
import { LOSS_CAUSES } from "@/domain/batches"

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
  minDate,
  maxDate,
  date,
  onDate,
  showEggs,
  entries,
}: {
  batchId: string
  minDate: string
  maxDate: string
  date: string
  onDate: (date: string) => void
  showEggs: boolean
  entries: DayEntry[]
}) {
  const t = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [v, setV] = useState(() => valuesFor(date, entries))
  const existing = entries.some((e) => e.date === date)

  const edit = (patch: Partial<typeof v>) => (setSaved(false), setV({ ...v, ...patch }))
  const box = (label: string, value: string, onChange: (s: string) => void, decimal = false) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <Input
        type="number"
        min={0}
        step={decimal ? "0.5" : "1"}
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 text-lg font-normal tabular-nums"
      />
    </label>
  )

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

      <div className="grid grid-cols-2 gap-3">
        {box(t("feedKg"), v.feedKg, (s) => edit({ feedKg: s }), true)}
        {showEggs && box(t("eggsCollected"), v.eggsCollected, (s) => edit({ eggsCollected: s }))}
        {showEggs && box(t("eggsBroken"), v.eggsBroken, (s) => edit({ eggsBroken: s }))}
      </div>

      <fieldset className="flex flex-col gap-2 rounded-xl border border-dashed p-3">
        <legend className="px-1 text-sm font-semibold">{t("lostToday")}</legend>
        <p className="text-xs text-muted-foreground">{t("lostTodayHint")}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
          {LOSS_CAUSES.map((c) => (
            <label key={c} className="flex flex-col gap-1 text-sm font-medium">
              {t(`cause_${c}`)}
              <Input
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                value={v.losses[c]}
                onChange={(e) => edit({ losses: { ...v.losses, [c]: e.target.value } })}
                className="h-11 font-normal tabular-nums"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        {box(t("sold"), v.sold, (s) => edit({ sold: s }))}
        {box(t("soldFor"), v.soldRupees, (s) => edit({ soldRupees: s }), true)}
        {box(t("given"), v.given, (s) => edit({ given: s }))}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t("soldHint")}</p>

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
