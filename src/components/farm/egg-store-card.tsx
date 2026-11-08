"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Egg } from "lucide-react"
import { Input } from "@/components/ui/input"
import { setEggStoreAction } from "@/app/actions/catalogue"
import { unitsFromEggs } from "@/domain/eggs"

/**
 * The farm's egg store on the Products page: eggs in store, what can be packed from it, and a way to set the count
 * after counting (batches add their good eggs by themselves; orders take eggs out).
 */
export function EggStoreCard({ eggs, products, fromBatches }: { eggs: number; products: { id: string; name: string; eggsPerUnit: number }[]; fromBatches: boolean }) {
  const t = useTranslations("farm.eggStore")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [counting, setCounting] = useState(false)
  const [value, setValue] = useState(String(eggs))

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-sec-products-tint p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-sec-products text-sec-on">
          <Egg className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{t("title")}</p>
          <p className="font-display text-3xl leading-tight font-bold tabular-nums">{t("eggs", { count: eggs })}</p>
        </div>
      </div>
      <ul className="grid gap-1.5">
        {products.map((p) => (
          <li key={p.id} className="flex justify-between gap-3 rounded-xl bg-card px-3 py-2 tabular-nums">
            <span className="min-w-0 truncate">{p.name}</span>
            <b className="shrink-0">{t("canPack", { count: unitsFromEggs(eggs, p.eggsPerUnit) })}</b>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{fromBatches ? t("hintBatches") : t("hint")}</p>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {counting ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setError(null)
              const r = await setEggStoreAction({ eggs: Number(value) })
              if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
              setCounting(false)
            })
          }}
        >
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
            {t("counted")}
            <Input required type="number" min={0} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} className="h-12 text-lg font-normal tabular-nums" />
          </label>
          <button type="submit" disabled={pending || value === ""} className="h-12 rounded-xl bg-sec-products px-4 font-bold text-sec-on disabled:opacity-50">
            {t("save")}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => (setValue(String(eggs)), setCounting(true))} className="h-11 self-start rounded-xl border-2 border-sec-products bg-card px-4 font-bold text-sec-products">
          {t("count")}
        </button>
      )}
    </section>
  )
}
