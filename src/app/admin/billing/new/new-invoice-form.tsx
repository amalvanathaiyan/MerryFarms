"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { FileCheck2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatRupees } from "@/domain/money"
import { createInvoiceAction } from "@/app/actions/platform-billing"

type Line = { text: string; rupees: number | null }
type Initial = { lines: Line[]; periodStart: string | null; periodEnd: string | null; dueOn: string }

/**
 * The invoice's lines (filled in from the farm's plan, each changeable), the period it covers and the day to pay by,
 * with the total worked out as you type. GST is added only while it is switched on; a farm without a GSTIN is asked
 * about once ("in another state?") because that decides CGST + SGST or IGST.
 */
export function NewInvoiceForm({ tenantId, initial, today, gst }: { tenantId: string; initial: Initial; today: string; gst: { rate: number; askState: boolean; otherState: boolean } | null }) {
  const t = useTranslations("admin.billing")
  const te = useTranslations("errors")
  const router = useRouter()
  const [lines, setLines] = useState<Line[]>(initial.lines.length ? initial.lines : [{ text: "", rupees: null }])
  const [period, setPeriod] = useState({ start: initial.periodStart ?? "", end: initial.periodEnd ?? "" })
  const [dueOn, setDueOn] = useState(initial.dueOn)
  const [otherState, setOtherState] = useState(gst?.otherState ?? false)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const paise = (r: number | null) => Math.round((r ?? 0) * 100)
  const subtotal = lines.reduce((a, l) => a + paise(l.rupees), 0)
  // As the server works it out (src/domain/platform-billing.ts): CGST + SGST is kept to an even number of paise
  const raw = gst ? Math.round((subtotal * gst.rate) / 100) : 0
  const tax = otherState ? raw : Math.round(raw / 2) * 2
  const ready = lines.some((l) => l.text.trim() && paise(l.rupees) > 0) && lines.every((l) => (!l.text.trim() && !l.rupees) || (l.text.trim() && paise(l.rupees) > 0))
  const setLine = (i: number, l: Partial<Line>) => setLines((x) => x.map((y, j) => (j === i ? { ...y, ...l } : y)))

  const submit = () =>
    start(async () => {
      setError(null)
      const r = await createInvoiceAction({
        tenantId,
        lines: lines.filter((l) => l.text.trim()).map((l) => ({ text: l.text.trim(), amountPaise: paise(l.rupees) })),
        periodStart: period.start || null,
        periodEnd: period.end || null,
        dueOn: dueOn || null,
        otherState,
        notes: notes.trim() || null,
      })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      router.push(`/admin/billing/${r.id}`)
    })

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("lines")}</legend>
        {lines.map((l, i) => (
          <div key={i} className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="sr-only">{t("lineText")}</span>
              <Input value={l.text} maxLength={120} placeholder={t("lineText")} onChange={(e) => setLine(i, { text: e.target.value })} />
            </label>
            <label className="flex w-28 flex-col gap-1">
              <span className="sr-only">{t("lineAmount")}</span>
              <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="₹" value={l.rupees ?? ""} onChange={(e) => setLine(i, { rupees: e.target.value === "" ? null : Number(e.target.value) })} className="text-right tabular-nums" />
            </label>
            {lines.length > 1 && (
              <Button type="button" variant="ghost" size="icon" aria-label={t("removeLine")} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
        {lines.length < 20 && (
          <Button type="button" variant="outline" className="self-start" onClick={() => setLines((x) => [...x, { text: "", rupees: null }])}>
            <Plus /> {t("addLine")}
          </Button>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("periodFrom")}</span>
          <Input type="date" value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("periodTo")}</span>
          <Input type="date" value={period.end} min={period.start || undefined} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("dueOn")}</span>
          <Input type="date" value={dueOn} min={today} onChange={(e) => setDueOn(e.target.value)} />
        </label>
      </div>

      {gst?.askState && (
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 accent-primary" checked={otherState} onChange={(e) => setOtherState(e.target.checked)} />
          <span>
            <span className="block font-semibold">{t("otherState")}</span>
            <span className="text-sm text-muted-foreground">{t("otherStateHint")}</span>
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("notes")}</span>
        <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-base" />
      </label>

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 tabular-nums">
        {gst && (
          <>
            <div className="flex justify-between">
              <dt>{t("subtotal")}</dt>
              <dd>{formatRupees(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("gstLine", { rate: gst.rate })}</dt>
              <dd>{formatRupees(tax)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between border-t pt-1 text-lg font-bold">
          <dt>{t("total")}</dt>
          <dd>{formatRupees(subtotal + tax)}</dd>
        </div>
      </dl>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={pending || !ready} className="h-12 self-end text-base">
        <FileCheck2 /> {t("makeInvoice")}
      </Button>
    </form>
  )
}
