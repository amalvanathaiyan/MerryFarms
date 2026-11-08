"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addBatch, editBatch } from "@/app/actions/batches"
import { BATCH_PURPOSES, BATCH_SOURCES } from "@/domain/batches"
import { cn } from "@/lib/utils"

export interface BatchFormValues {
  name: string
  breed: string
  purpose: string
  source: string
  supplier: string
  startDate: string
  ageAtStartDays: string
  startCount: string
  eggsSet: string
  parentBatchId: string
  eggValueRupees: string
  note: string
}

const num = (v: string) => (v.trim() === "" ? null : Number(v))

/** Adds a batch (bought in or hatched here), or changes one. */
export function BatchForm({
  id,
  number,
  today,
  initial,
  parents,
}: {
  /** Set when changing a batch. */
  id?: string
  /** The batch's number, when changing it (it can be renumbered). */
  number?: number
  today: string
  initial: BatchFormValues
  parents: { id: string; name: string }[]
}) {
  const t = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState(initial)
  const [cost, setCost] = useState("")
  const [batchNo, setBatchNo] = useState(number != null ? String(number) : "")
  const set = (k: keyof BatchFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value })
  const bought = v.source === "bought"

  const chips = (key: "purpose" | "source", options: readonly string[]) => (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={v[key] === o} onClick={() => setV({ ...v, [key]: o })} className={cn("rounded-full border px-4 py-2 text-sm font-medium", v[key] === o ? "border-primary bg-accent" : "bg-card")}>
          {t(`${key}_${o}`)}
        </button>
      ))}
    </div>
  )
  const field = (label: string, input: React.ReactNode, hint?: string) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      {input}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
  const numberInput = (k: keyof BatchFormValues, opts: { required?: boolean; min?: number; decimal?: boolean } = {}) => (
    <Input
      type="number"
      required={opts.required}
      min={opts.min ?? 0}
      step={opts.decimal ? "0.5" : "1"}
      inputMode={opts.decimal ? "decimal" : "numeric"}
      value={v[k]}
      onChange={set(k)}
      className="h-12 text-lg font-normal tabular-nums"
    />
  )

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const input = {
            name: v.name || undefined,
            breed: v.breed || undefined,
            purpose: v.purpose,
            source: v.source,
            supplier: v.supplier || undefined,
            startDate: v.startDate,
            ageAtStartDays: bought ? (num(v.ageAtStartDays) ?? 0) : 0,
            startCount: Number(v.startCount),
            eggsSet: bought ? null : num(v.eggsSet),
            parentBatchId: bought ? null : v.parentBatchId || null,
            eggValueRupees: num(v.eggValueRupees),
            note: v.note || undefined,
          }
          const r = id ? await editBatch(id, { ...input, number: num(batchNo) ?? undefined }) : await addBatch({ ...input, chicksCostRupees: bought ? num(cost) : null })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          router.push(`/farm/poultry/batches/${id ?? r.id}`)
        })
      }}
    >
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("whereFrom")}</span>
        {chips("source", BATCH_SOURCES)}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("whatFor")}</span>
        {chips("purpose", BATCH_PURPOSES)}
      </div>

      {id && field(t("batchNumber"), <Input required type="number" min={1} max={9999} inputMode="numeric" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} className="h-12 w-32 text-lg font-normal tabular-nums" />, t("batchNumberHint"))}

      <div className="grid gap-3 sm:grid-cols-2">
        {field(t("name"), <Input value={v.name} maxLength={60} onChange={set("name")} placeholder={t("namePlaceholder")} className="h-12 font-normal" />)}
        {field(t("breed"), <Input value={v.breed} maxLength={60} onChange={set("breed")} placeholder={t("breedPlaceholder")} className="h-12 font-normal" />)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field(bought ? t("startDateBought") : t("startDateHatched"), <Input type="date" required max={today} value={v.startDate} onChange={set("startDate")} className="h-12 font-normal" />)}
        {field(bought ? t("startCountBought") : t("startCountHatched"), numberInput("startCount", { required: true, min: 1 }))}
      </div>

      {bought ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field(t("ageAtStart"), numberInput("ageAtStartDays"), t("ageAtStartHint"))}
            {!id && field(t("chicksCost"), <Input type="number" min={0} step="1" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="h-12 text-lg font-normal tabular-nums" />, t("chicksCostHint"))}
          </div>
          {field(t("supplier"), <Input value={v.supplier} maxLength={80} onChange={set("supplier")} className="h-12 font-normal" />)}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {field(t("eggsSet"), numberInput("eggsSet"), t("eggsSetHint"))}
          {parents.length > 0 &&
            field(
              t("parentBatch"),
              <select value={v.parentBatchId} onChange={set("parentBatchId")} className="h-12 rounded-md border bg-background px-3 font-normal">
                <option value="">{t("parentNone")}</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
        </div>
      )}

      {v.purpose !== "meat" && field(t("eggValue"), numberInput("eggValueRupees", { decimal: true }), t("eggValueHint"))}

      {field(t("note"), <Input value={v.note} maxLength={200} onChange={set("note")} className="h-12 font-normal" />)}

      <Button type="submit" size="lg" disabled={pending || !(Number(v.startCount) >= 1) || !v.startDate}>
        {id ? t("saveBatch") : t("addBatch")}
      </Button>
    </form>
  )
}
