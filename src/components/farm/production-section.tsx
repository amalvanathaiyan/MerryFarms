"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveProductionAction } from "@/app/actions/records"

type Product = { id: string; name: string; pack: string; unit: string }
type Entry = { date: string; productId: string; made: number; wasted: number }

/** "Made / collected" per product for a day: bottles of oil, litres of milk, packs of eggs. */
export function ProductionSection({ today, products, entries, toStock }: { today: string; products: Product[]; entries: Entry[]; toStock: boolean }) {
  const t = useTranslations("farm.records")
  const tu = useTranslations("farm.units")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const valuesFor = (date: string) =>
    Object.fromEntries(
      products.map((p) => {
        const e = entries.find((x) => x.date === date && x.productId === p.id)
        return [p.id, { made: e ? String(e.made) : "", wasted: e && e.wasted ? String(e.wasted) : "" }]
      })
    )
  const [date, setDate] = useState(today)
  const [values, setValues] = useState(() => valuesFor(today))
  const unitName = (u: string) => (tu.has(u) ? tu(u) : u)

  if (products.length === 0) return null

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          setSaved(false)
          const list = products.map((p) => ({ productId: p.id, made: Number(values[p.id].made || 0), wasted: Number(values[p.id].wasted || 0) }))
          const r = await saveProductionAction({ date, entries: list })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          setSaved(true)
        })
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("productionTitle")}</h2>
        <Input type="date" max={today} value={date} onChange={(e) => e.target.value && (setSaved(false), setDate(e.target.value), setValues(valuesFor(e.target.value)))} className="h-10 w-auto" />
      </div>
      <p className="text-sm text-muted-foreground">{toStock ? t("productionHintStock") : t("productionHint")}</p>
      <div className="grid grid-cols-[1fr_5.5rem_5.5rem] items-end gap-x-2 gap-y-3">
        <span />
        <span className="text-xs font-semibold text-muted-foreground">{t("made")}</span>
        <span className="text-xs font-semibold text-muted-foreground">{t("spoiled")}</span>
        {products.map((p) => (
          <div key={p.id} className="contents">
            <div className="min-w-0 self-center">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {p.pack} · {unitName(p.unit)}
              </div>
            </div>
            {(["made", "wasted"] as const).map((k) => (
              <Input
                key={k}
                type="number"
                min={0}
                step="0.5"
                inputMode="decimal"
                aria-label={`${p.name} ${k === "made" ? t("made") : t("spoiled")}`}
                value={values[p.id][k]}
                onChange={(e) => (setSaved(false), setValues({ ...values, [p.id]: { ...values[p.id], [k]: e.target.value } }))}
                className="h-11 tabular-nums"
              />
            ))}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {saved ? `✓ ${t("saved")}` : t("saveProduction")}
      </Button>
    </form>
  )
}
