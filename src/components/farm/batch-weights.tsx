"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Scale, Trash2 } from "lucide-react"
import { deleteWeightAction, saveWeightAction } from "@/app/actions/weights"
import { useCheer } from "@/components/cheer"
import { weeksAndDays } from "@/domain/batches"
import { avgGrams, MAX_WEIGHED, weightText, type WeightPoint } from "@/domain/weights"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { NumberStepper } from "./number-stepper"
import { WeightChart } from "./weight-chart"

export type WeightItem = WeightPoint & { id: string; dayText: string }

/**
 * A batch's weekly weights: the latest average bird, the growth line by age, a quick weighing form (how many birds,
 * their weight together) and every weighing in a table.
 */
export function BatchWeights({
  batchId,
  batchName,
  minDate,
  maxDate,
  weights,
  due,
  open: openAtStart,
}: {
  batchId: string
  batchName: string
  minDate: string
  maxDate: string
  weights: WeightItem[]
  due: { due: boolean; daysSince: number | null }
  /** Batches still on the farm open the form when a weighing is due. */
  open: boolean
}) {
  const t = useTranslations("farm.weights")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(openAtStart)
  const last = weights[weights.length - 1]
  const blank = { date: maxDate, birds: String(last?.birds ?? 10), kg: "", note: "" }
  const [v, setV] = useState(blank)

  const fmt = (g: number) => {
    const w = weightText(g)
    return `${w.value} ${t(w.unit)}`
  }
  const age = (days: number) => {
    const wd = weeksAndDays(Math.max(0, days))
    return [wd.weeks ? t("ageWeeks", { weeks: wd.weeks }) : "", wd.days || !wd.weeks ? t("ageDays", { days: wd.days }) : ""].filter(Boolean).join(" ")
  }
  const gain = (g: number | null) => (g == null ? null : g >= 0 ? t("gain", { grams: g }) : t("drop", { grams: g }))

  const birds = Number(v.birds)
  const kg = Number(v.kg)
  const preview = birds > 0 && kg > 0 ? weightText(avgGrams({ birds, totalGrams: Math.round(kg * 1000) })) : null

  return (
    <section id="weights" className="flex scroll-mt-32 flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sec-poultry">
            <Scale className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("hint")}</p>
          </div>
        </div>
        {(due.due || due.daysSince != null) && (
          <span className={cn("rounded-full border px-2.5 py-0.5 text-sm font-semibold", due.due ? "border-sec-poultry/40 text-sec-poultry" : "text-muted-foreground")}>
            {due.due ? (due.daysSince == null ? t("dueFirst") : t("due")) : t("weighedAgo", { days: due.daysSince! })}
          </span>
        )}
      </div>

      {last && (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-muted-foreground">{t("latest")}</span>
          <span className="font-display text-3xl leading-none font-bold tabular-nums">{fmt(last.avgGrams)}</span>
          <span className="text-sm text-muted-foreground">
            {t("detail", { birds: last.birds, age: age(last.ageDays) })} · {last.dayText}
          </span>
          {last.gainPerDay != null && <span className="text-sm font-semibold">{gain(last.gainPerDay)}</span>}
        </div>
      )}

      {weights.length >= 2 ? (
        <WeightChart
          label={t("chartLabel")}
          axisAge={t("axisAge")}
          fmt={fmt}
          axisFmt={(g, inKg) => (inKg ? String(g / 1000) : String(g))}
          unit={(inKg) => t(inKg ? "kg" : "g")}
          points={weights.map((p) => ({
            ageDays: p.ageDays,
            avgGrams: p.avgGrams,
            lines: [`${age(p.ageDays)} · ${p.dayText}`, t("birdsWeighed", { birds: p.birds }), gain(p.gainPerDay)].filter((x): x is string => !!x),
          }))}
        />
      ) : (
        weights.length === 1 && <p className="text-sm text-muted-foreground">{t("oneMore")}</p>
      )}

      {open ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setError(null)
              const r = await saveWeightAction(batchId, { date: v.date, birds, totalKg: kg, note: v.note || undefined })
              if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
              const w = weightText(avgGrams({ birds, totalGrams: Math.round(kg * 1000) }))
              cheer("weight", { batch: batchName, avg: `${w.value} ${t(w.unit)}` })
              setV({ ...blank, birds: v.birds })
              setOpen(false)
            })
          }}
        >
          <h3 className="font-bold">{t("formTitle")}</h3>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold">
            {t("day")}
            <Input type="date" required min={minDate} max={maxDate} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="h-11 w-auto" />
          </label>
          <NumberStepper label={t("birds")} value={v.birds} onChange={(s) => setV({ ...v, birds: s })} />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("total")}
            <Input required type="number" inputMode="decimal" min={0.01} max={10000} step="0.01" value={v.kg} onChange={(e) => setV({ ...v, kg: e.target.value })} className="h-12 text-lg font-normal" />
            <span className="font-normal text-muted-foreground">{t("totalHint")}</span>
          </label>
          {preview && <p className="text-base font-bold tabular-nums">= {t("preview", { value: preview.value, unit: t(preview.unit) })}</p>}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending || !(birds >= 1 && birds <= MAX_WEIGHED) || !(kg > 0)}>
            <Scale /> {pending ? t("saving") : t("save")}
          </Button>
        </form>
      ) : (
        <Button variant={due.due ? "default" : "outline"} size="lg" className="self-start" onClick={() => setOpen(true)}>
          <Scale /> {t("formTitle")}
        </Button>
      )}

      {weights.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">{t("history")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-1.5 font-medium">{t("colDay")}</th>
                  <th className="py-1 pr-1.5 text-right font-medium">{t("colAvg")}</th>
                  <th className="py-1 pr-1.5 text-right font-medium">{t("colGain")}</th>
                  <th className="w-9" aria-label={t("delete")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {[...weights].reverse().map((w) => (
                  <tr key={w.id}>
                    <td className="py-1.5 pr-1.5">
                      <span className="block whitespace-nowrap">{w.dayText}</span>
                      <span className="block text-xs text-muted-foreground">
                        {age(w.ageDays)} · {t("birdsShort", { birds: w.birds })}
                      </span>
                    </td>
                    <td className="py-1.5 pr-1.5 text-right font-semibold">{fmt(w.avgGrams)}</td>
                    <td className="py-1.5 pr-1.5 text-right whitespace-nowrap">{w.gainPerDay == null ? "—" : `${w.gainPerDay >= 0 ? "+" : ""}${w.gainPerDay}`}</td>
                    <td>
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
                        aria-label={t("delete")}
                        disabled={pending}
                        onClick={() =>
                          window.confirm(t("deleteConfirm", { day: w.dayText })) &&
                          start(async () => {
                            const r = await deleteWeightAction(w.id)
                            if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
                            else cheer("deleted")
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
