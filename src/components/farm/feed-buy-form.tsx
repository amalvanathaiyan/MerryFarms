"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { addExpense } from "@/app/actions/records"

/** Owner: feed bought, with its kg and price. It fills the feed store and prices the feed each batch eats. */
export function FeedBuyForm({ today }: { today: string }) {
  const t = useTranslations("farm.feed")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const blank = { kg: "", amount: "", date: today, note: "" }
  const [v, setV] = useState(blank)

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          setSaved(false)
          const r = await addExpense({ date: v.date, kind: "feed", amountRupees: Number(v.amount), quantityKg: Number(v.kg), note: v.note || undefined })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          setV({ ...blank, date: v.date })
          setSaved(true)
        })
      }}
    >
      <h2 className="text-lg font-bold">{t("buyTitle")}</h2>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 font-semibold">
          {t("kg")}
          <Input required type="number" min={0.5} step="0.5" inputMode="decimal" value={v.kg} onChange={(e) => (setSaved(false), setV({ ...v, kg: e.target.value }))} className="h-12 text-lg font-normal tabular-nums" />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">
          {t("paid")}
          <Input required type="number" min={1} step="1" inputMode="decimal" value={v.amount} onChange={(e) => (setSaved(false), setV({ ...v, amount: e.target.value }))} className="h-12 text-lg font-normal tabular-nums" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 font-semibold">
          {t("date")}
          <Input type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="h-12 font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">
          {t("note")}
          <Input value={v.note} maxLength={120} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={t("notePlaceholder")} className="h-12 font-normal" />
        </label>
      </div>
      <button type="submit" disabled={pending || !(Number(v.kg) > 0) || !(Number(v.amount) > 0)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sec-poultry text-base font-bold text-sec-on disabled:opacity-50">
        <Plus className="size-5" aria-hidden /> {saved ? `✓ ${t("saved")}` : t("buyButton")}
      </button>
    </form>
  )
}
