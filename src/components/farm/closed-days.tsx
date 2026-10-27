"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { CalendarOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addClosedDay, removeClosedDay } from "@/app/actions/slots"

export type ClosedDayRow = { id: string; dayText: string; slotText: string | null; note: string | null; booked: number }

/** Days with no deliveries: festivals, family events, rest days. */
export function ClosedDays({ rows, slots, today, canEdit }: { rows: ClosedDayRow[]; slots: { id: string; label: string }[]; today: string; canEdit: boolean }) {
  const t = useTranslations("farm.slots")
  const te = useTranslations("errors")
  const [date, setDate] = useState("")
  const [slotId, setSlotId] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarOff className="size-5" /> {t("closedDays")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("closedDaysHint")}</p>
      </div>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("noClosedDays")}</p>}
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="font-medium">
                {r.dayText} · {r.slotText ?? t("wholeDay")}
              </div>
              {r.note && <div className="text-sm text-muted-foreground">{r.note}</div>}
              {r.booked > 0 && <div className="text-sm font-semibold text-destructive">{t("alreadyBooked", { count: r.booked })}</div>}
            </div>
            {canEdit && (
              <button type="button" className="grid size-9 shrink-0 place-items-center rounded-lg text-destructive" disabled={pending} aria-label={t("reopen")} onClick={() => run(() => removeClosedDay(r.id))}>
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form
          className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => addClosedDay({ date, slotId: slotId || null, note: note || undefined }), () => (setDate(""), setNote("")))
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("date")}
              <Input required type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="font-normal" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("which")}
              <select className="h-9 rounded-md border border-input bg-transparent px-2 font-normal" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                <option value="">{t("wholeDay")}</option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("closedNote")}
            <Input value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder={t("closedNotePlaceholder")} className="font-normal" />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending || !date}>
            {t("addClosedDay")}
          </Button>
        </form>
      )}
    </section>
  )
}
