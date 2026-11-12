"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Scale } from "lucide-react"
import { saveWeightAction } from "@/app/actions/weights"
import { useCheer } from "@/components/cheer"
import { avgGrams, MAX_WEIGHED, weightText } from "@/domain/weights"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NumberStepper } from "./number-stepper"

/**
 * Growth · weigh some birds of one batch, on any day: how many, and their weight together. Opens by itself when a
 * weighing is due; otherwise it's one button.
 */
export function WeighForm({ batchId, batchName, minDate, maxDate, lastBirds, due }: { batchId: string; batchName: string; minDate: string; maxDate: string; lastBirds: number | null; due: boolean }) {
  const t = useTranslations("farm.weights")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(due)
  const blank = { date: maxDate, birds: String(lastBirds ?? 10), kg: "" }
  const [v, setV] = useState(blank)
  const birds = Number(v.birds)
  const kg = Number(v.kg)
  const preview = birds > 0 && kg > 0 ? weightText(avgGrams({ birds, totalGrams: Math.round(kg * 1000) })) : null

  if (!open)
    return (
      <Button variant={due ? "default" : "outline"} size="lg" className="self-start" onClick={() => setOpen(true)}>
        <Scale /> {t("formTitle")}
      </Button>
    )

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const r = await saveWeightAction(batchId, { date: v.date, birds, totalKg: kg })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          if (preview) cheer("weight", { batch: batchName, avg: `${preview.value} ${t(preview.unit)}` })
          setV({ ...blank, birds: v.birds })
          setOpen(false)
        })
      }}
    >
      <h3 className="font-bold">{t("formTitle")}</h3>
      <label className="flex items-center justify-between gap-3 text-sm font-semibold">
        {t("formDay")}
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
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending || !(birds >= 1 && birds <= MAX_WEIGHED) || !(kg > 0)}>
          <Scale /> {pending ? t("formSaving") : t("formSave")}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
          {t("formCancel")}
        </Button>
      </div>
    </form>
  )
}
