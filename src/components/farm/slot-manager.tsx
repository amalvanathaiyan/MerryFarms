"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteSlot, saveSlot } from "@/app/actions/slots"
import type { ActionResult } from "@/app/actions/catalogue"
import { slotRangeLabel } from "@/domain/slots"
import { pick, weekdayNames } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"

type Slot = {
  id: string
  nameTa: string
  nameEn: string
  startTime: string
  endTime: string
  daysOfWeek: number[]
  cutoffHours: number
  maxOrders: number
  isActive: boolean
}
type Draft = Omit<Slot, "id"> & { id?: string }

const WEEK = [1, 2, 3, 4, 5, 6, 0] // Monday first, as farms plan their week
const CUTOFFS = [2, 4, 6, 8, 12, 24, 48]

export function SlotManager({ slots, canEdit }: { slots: Slot[]; canEdit: boolean }) {
  const t = useTranslations("farm.slots")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const locale = useLocale()
  const days = weekdayNames(locale)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [armedDelete, setArmedDelete] = useState(false)

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })

  const daysText = (ds: number[]) => (ds.length === 7 ? t("everyDay") : WEEK.filter((d) => ds.includes(d)).map((d) => days[d]).join(", "))

  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {error}
    </p>
  )

  if (draft) {
    const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })
    return (
      <form
        className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveSlot(draft), () => setDraft(null))
        }}
      >
        <h2 className="text-lg font-semibold">{draft.id ? t("editTitle") : t("addTitle")}</h2>
        {errorBox}
        <div className="grid grid-cols-2 gap-3">
          <Labelled label={t("nameTa")}>
            <Input required lang="ta" value={draft.nameTa} onChange={(e) => set("nameTa", e.target.value)} placeholder="காலை" />
          </Labelled>
          <Labelled label={t("nameEn")}>
            <Input required lang="en" value={draft.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Morning" />
          </Labelled>
          <Labelled label={t("start")}>
            <Input required type="time" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </Labelled>
          <Labelled label={t("end")}>
            <Input required type="time" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} />
          </Labelled>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("days")}</legend>
          <div className="flex flex-wrap gap-2">
            {WEEK.map((d) => {
              const on = draft.daysOfWeek.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("daysOfWeek", on ? draft.daysOfWeek.filter((x) => x !== d) : [...draft.daysOfWeek, d])}
                  className={cn("min-w-12 rounded-full border px-3 py-2 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")}
                >
                  {days[d]}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Labelled label={t("cutoff")}>
            <select className="h-9 rounded-md border border-input bg-transparent px-2" value={draft.cutoffHours} onChange={(e) => set("cutoffHours", Number(e.target.value))}>
              {CUTOFFS.map((h) => (
                <option key={h} value={h}>
                  {t("cutoffHours", { hours: h })}
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label={t("maxOrders")}>
            <Input required type="number" min={1} inputMode="numeric" value={draft.maxOrders} onChange={(e) => set("maxOrders", Number(e.target.value))} />
          </Labelled>
        </div>
        <label className="flex items-center justify-between gap-3 font-medium">
          {t("active")}
          <input type="checkbox" className="size-6 accent-[hsl(var(--primary))]" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={pending} className="flex-1">
            {tc("save")}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => setDraft(null)}>
            {tc("cancel")}
          </Button>
        </div>
        {draft.id && (
          <Button
            type="button"
            variant={armedDelete ? "destructive" : "ghost"}
            className={armedDelete ? undefined : "text-destructive"}
            disabled={pending}
            onClick={() => {
              if (!armedDelete) return setArmedDelete(true)
              setArmedDelete(false)
              run(() => deleteSlot(draft.id!), () => setDraft(null))
            }}
          >
            {armedDelete ? tc("confirmDelete") : tc("delete")}
          </Button>
        )}
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {errorBox}
      {canEdit && (
        <Button
          size="lg"
          onClick={() =>
            setDraft({ nameTa: "", nameEn: "", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 20, isActive: true })
          }
        >
          {t("add")}
        </Button>
      )}
      {slots.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("none")}</p>}
      <ul className="flex flex-col gap-3">
        {slots.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="min-w-0">
              <div className="font-semibold">
                {pick(locale, s.nameTa, s.nameEn)} · {slotRangeLabel(s.startTime, s.endTime)}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("summary", { days: daysText(s.daysOfWeek), hours: s.cutoffHours, max: s.maxOrders })}
              </div>
              {!s.isActive && <div className="text-sm font-medium text-destructive">{t("closed")}</div>}
            </div>
            {canEdit && (
              <Button variant="outline" onClick={() => setDraft(s)}>
                {tc("edit")}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <span className="contents font-normal">{children}</span>
    </label>
  )
}
