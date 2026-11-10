"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addScheduleItemAction, deleteScheduleItemAction } from "@/app/actions/vaccinations"
import { VACCINE_METHODS } from "@/domain/vaccinations"
import { weeksAndDays } from "@/domain/batches"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

type Item = { id: string; vaccine: string; ageDays: number; method: string | null }

/** Owner: the farm's own vaccine plan by age. Each new batch gets a copy of it. */
export function VaccineSchedule({ items }: { items: Item[] }) {
  const t = useTranslations("farm.vaccines")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const blank = { vaccine: "", ageDays: "", method: "" }
  const [v, setV] = useState(blank)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else {
        after?.()
        cheer("vaccinePlan")
      }
    })

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("planEmpty")}</p>
        ) : (
          <ul className="divide-y">
            {items.map((i) => {
              const w = weeksAndDays(i.ageDays)
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{i.vaccine}</div>
                    <div className="text-sm text-muted-foreground">
                      {t("atAge", { days: i.ageDays })}
                      {w.weeks > 0 && ` (${t("weeks", { weeks: w.weeks, rest: w.days })})`}
                      {i.method && ` · ${t(`method_${i.method}`)}`}
                    </div>
                  </div>
                  <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground" aria-label={t("delete")} disabled={pending} onClick={() => run(() => deleteScheduleItemAction(i.id))}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-dashed bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => addScheduleItemAction({ vaccine: v.vaccine, ageDays: Number(v.ageDays), method: v.method || null }), () => setV(blank))
        }}
      >
        <h2 className="font-semibold">{t("planAdd")}</h2>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("vaccine")}
            <Input required maxLength={60} value={v.vaccine} onChange={(e) => setV({ ...v, vaccine: e.target.value })} placeholder={t("vaccinePlaceholder")} className="h-11 font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("ageDays")}
            <Input required type="number" min={0} inputMode="numeric" value={v.ageDays} onChange={(e) => setV({ ...v, ageDays: e.target.value })} className="h-11 font-normal tabular-nums" />
          </label>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("howGiven")}</span>
          <div className="flex flex-wrap gap-2">
            {VACCINE_METHODS.map((m) => (
              <button key={m} type="button" aria-pressed={v.method === m} onClick={() => setV({ ...v, method: v.method === m ? "" : m })} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", v.method === m ? "border-primary bg-accent" : "bg-card")}>
                {t(`method_${m}`)}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={pending || !v.vaccine.trim() || v.ageDays === ""}>
          {t("planAddButton")}
        </Button>
      </form>
    </div>
  )
}
