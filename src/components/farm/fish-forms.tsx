"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { AlertTriangle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addSampleAction, addStockingAction, closeCycleAction, removeSampleAction, removeStockingAction, reopenCycleAction, saveFishDayAction, startCycleAction } from "@/app/actions/fish"
import { FISH_SPECIES, isFishSpecies, WATER_CHECKS, waterWarnings, type WaterCheck } from "@/domain/fish"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

const field = "flex flex-col gap-1.5 text-sm font-semibold"
const select = "h-12 rounded-md border bg-background px-3 text-base font-normal"
const num = (s: string) => (s.trim() === "" ? null : Number(s))

function useRun() {
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, after?: (id?: string) => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      cheer("settings")
      after?.(r.id)
      router.refresh()
    })
  return { pending, error, run }
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {text}
    </p>
  ) : null
}

/** A kind of fish in the farm's words: one of the list, or the farm's own name. */
export function useSpeciesName() {
  const t = useTranslations("farm.fish")
  return (s: string | null) => (s == null ? t("allKinds") : isFishSpecies(s) ? t(`species_${s}`) : s)
}

type StockingState = { date: string; species: string; own: string; count: string; sizeGrams: string; costRupees: string; supplier: string }
const blankStocking = (today: string): StockingState => ({ date: today, species: "rohu", own: "", count: "", sizeGrams: "", costRupees: "", supplier: "" })
const stockingPayload = (s: StockingState) => ({
  date: s.date,
  species: s.species === "own" ? s.own : s.species,
  count: Math.round(Number(s.count)),
  sizeGrams: num(s.sizeGrams),
  costRupees: num(s.costRupees) ?? 0,
  supplier: s.supplier.trim() || null,
})

/** What was put in: which fish, how many, how big, what they cost. */
function StockingFields({ s, set }: { s: StockingState; set: (s: StockingState) => void }) {
  const t = useTranslations("farm.fish")
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("species")}
          <select value={s.species} onChange={(e) => set({ ...s, species: e.target.value })} className={select}>
            {FISH_SPECIES.map((k) => (
              <option key={k} value={k}>
                {t(`species_${k}`)}
              </option>
            ))}
            <option value="own">{t("speciesOwn")}</option>
          </select>
        </label>
        <label className={field}>
          {t("count")}
          <Input required type="number" min={1} step={1} inputMode="numeric" value={s.count} onChange={(e) => set({ ...s, count: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      {s.species === "own" && (
        <label className={field}>
          {t("speciesName")}
          <Input required maxLength={40} value={s.own} onChange={(e) => set({ ...s, own: e.target.value })} className="h-12 font-normal" />
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("date")}
          <Input required type="date" value={s.date} onChange={(e) => set({ ...s, date: e.target.value })} className="h-12 font-normal" />
        </label>
        <label className={field}>
          {t("sizeGrams")}
          <Input type="number" min={0} step="any" inputMode="decimal" value={s.sizeGrams} onChange={(e) => set({ ...s, sizeGrams: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("cost")}
          <Input type="number" min={0} step="any" inputMode="decimal" value={s.costRupees} onChange={(e) => set({ ...s, costRupees: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
        <label className={field}>
          {t("supplier")}
          <Input maxLength={80} value={s.supplier} onChange={(e) => set({ ...s, supplier: e.target.value })} className="h-12 font-normal" />
        </label>
      </div>
    </>
  )
}

/** A new cycle: which pond, and the first fish put in. */
export function StartCycle({ ponds, today }: { ponds: { id: string; name: string }[]; today: string }) {
  const t = useTranslations("farm.fish")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [placeId, setPlaceId] = useState(ponds[0]?.id ?? "")
  const [s, setS] = useState(blankStocking(today))
  const { pending, error, run } = useRun()
  if (!open)
    return (
      <Button type="button" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {t("startCycle")}
      </Button>
    )
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border-2 border-sec-fish bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => startCycleAction({ placeId, note: null, stocking: stockingPayload(s) }), (id) => id && router.push(`/farm/fish/${id}`))
      }}
    >
      <h2 className="text-lg font-semibold">{t("startCycle")}</h2>
      <label className={field}>
        {t("pond")}
        <select required value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={select}>
          {ponds.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <StockingFields s={s} set={setS} />
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {t("startCycle")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

/** More fish put in, on the cycle's page. */
export function AddStocking({ cycleId, today }: { cycleId: string; today: string }) {
  const t = useTranslations("farm.fish")
  const [open, setOpen] = useState(false)
  const [s, setS] = useState(blankStocking(today))
  const { pending, error, run } = useRun()
  if (!open)
    return (
      <Button type="button" variant="outline" className="h-11 self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {t("addStocking")}
      </Button>
    )
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => addStockingAction({ cycleId, stocking: stockingPayload(s) }), () => (setOpen(false), setS(blankStocking(today))))
      }}
    >
      <StockingFields s={s} set={setS} />
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={pending}>
          {t("addStocking")}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

export interface FishDayValues {
  feedKg: number | null
  feedInputId: string | null
  dead: number
  ph: number | null
  oxygen: number | null
  tempC: number | null
  ammonia: number | null
  note: string | null
}

const READING_STEP: Record<WaterCheck, string> = { ph: "0.1", oxygen: "0.1", tempC: "0.5", ammonia: "0.01" }

/**
 * The pond's day: feed (out of the store), fish found dead, and water checks. Readings outside the safe range are
 * shown at once with what to do.
 */
export function FishDayForm({ cycleId, date, values, feeds, left }: { cycleId: string; date: string; values: FishDayValues | null; feeds: { id: string; name: string }[]; left: number }) {
  const t = useTranslations("farm.fish")
  const router = useRouter()
  const [v, setV] = useState({
    feedKg: values?.feedKg?.toString() ?? "",
    feedInputId: values?.feedInputId ?? (values ? "" : (feeds[0]?.id ?? "")),
    dead: values?.dead ? String(values.dead) : "",
    ph: values?.ph?.toString() ?? "",
    oxygen: values?.oxygen?.toString() ?? "",
    tempC: values?.tempC?.toString() ?? "",
    ammonia: values?.ammonia?.toString() ?? "",
    note: values?.note ?? "",
  })
  const [saved, setSaved] = useState(false)
  const { pending, error, run } = useRun()
  const warnings = waterWarnings({ ph: num(v.ph), oxygen: num(v.oxygen), tempC: num(v.tempC), ammonia: num(v.ammonia) })
  const set = (patch: Partial<typeof v>) => (setSaved(false), setV({ ...v, ...patch }))
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            saveFishDayAction({
              cycleId,
              date,
              feedKg: num(v.feedKg),
              feedInputId: v.feedInputId || null,
              dead: Math.round(num(v.dead) ?? 0),
              ph: num(v.ph),
              oxygen: num(v.oxygen),
              tempC: num(v.tempC),
              ammonia: num(v.ammonia),
              note: v.note.trim() || null,
            }),
          () => (setSaved(true), router.refresh())
        )
      }}
    >
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-semibold">{t("feedTitle")}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            {t("feedKg")}
            <Input type="number" min={0} step="any" inputMode="decimal" value={v.feedKg} onChange={(e) => set({ feedKg: e.target.value })} className="h-12 text-lg font-normal tabular-nums" />
          </label>
          <label className={field}>
            {t("feedFrom")}
            <select value={v.feedInputId} onChange={(e) => set({ feedInputId: e.target.value })} className={select}>
              {feeds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value="">{t("feedNotStore")}</option>
            </select>
          </label>
        </div>
        {feeds.length === 0 && <p className="text-sm text-muted-foreground">{t("feedNoItems")}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <label className={field}>
          {t("dead")}
          <Input type="number" min={0} max={left} step={1} inputMode="numeric" value={v.dead} onChange={(e) => set({ dead: e.target.value })} placeholder="0" className="h-12 text-lg font-normal tabular-nums" />
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">{t("waterTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("waterHint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {WATER_CHECKS.map((k) => (
            <label key={k} className={field}>
              {t(`water_${k}`)}
              <Input type="number" min={0} step={READING_STEP[k]} inputMode="decimal" value={v[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-12 font-normal tabular-nums" />
            </label>
          ))}
        </div>
        {warnings.length > 0 && (
          <ul className="flex flex-col gap-2">
            {warnings.map((w) => (
              <li key={w.check} className={cn("flex gap-2 rounded-lg px-3 py-2 text-sm", w.danger ? "bg-destructive/10 text-destructive" : "bg-yolk text-yolk-foreground")}>
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <b>{t(`warn_${w.check}_${w.side}`)}</b> {t(`do_${w.check}_${w.side}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <label className={field}>
        {t("note")}
        <textarea rows={2} maxLength={300} value={v.note} onChange={(e) => set({ note: e.target.value })} className="rounded-xl border bg-card px-3 py-2 text-base font-normal" />
      </label>
      <ErrorLine text={error} />
      <button type="submit" disabled={pending} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sec-fish text-lg font-bold text-sec-on shadow-lg disabled:opacity-60">
        {saved ? t("saved") : t("saveDay")}
      </button>
    </form>
  )
}

/** A net sample: how many fish, and what they weighed together. */
export function AddSample({ cycleId, today, kinds }: { cycleId: string; today: string; kinds: string[] }) {
  const t = useTranslations("farm.fish")
  const name = useSpeciesName()
  const [open, setOpen] = useState(false)
  const blank = { date: today, species: "", count: "", totalKg: "" }
  const [s, setS] = useState(blank)
  const { pending, error, run } = useRun()
  if (!open)
    return (
      <Button type="button" variant="outline" className="h-11 self-start" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> {t("addSample")}
      </Button>
    )
  const avg = Number(s.count) > 0 && Number(s.totalKg) > 0 ? Math.round((Number(s.totalKg) * 1000) / Number(s.count)) : null
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () => addSampleAction({ cycleId, date: s.date, species: s.species || null, count: Math.round(Number(s.count)), totalGrams: Number(s.totalKg) * 1000 }),
          () => (setOpen(false), setS(blank))
        )
      }}
    >
      <p className="text-sm text-muted-foreground">{t("sampleHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("date")}
          <Input required type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} className="h-12 font-normal" />
        </label>
        {kinds.length > 1 ? (
          <label className={field}>
            {t("species")}
            <select value={s.species} onChange={(e) => setS({ ...s, species: e.target.value })} className={select}>
              <option value="">{t("allKinds")}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {name(k)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("sampleCount")}
          <Input required type="number" min={1} step={1} inputMode="numeric" value={s.count} onChange={(e) => setS({ ...s, count: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
        <label className={field}>
          {t("sampleKg")}
          <Input required type="number" min={0} step="any" inputMode="decimal" value={s.totalKg} onChange={(e) => setS({ ...s, totalKg: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      {avg != null && <p className="text-sm font-semibold">{t("eachAbout", { grams: avg })}</p>}
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={pending}>
          {t("addSample")}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

/** Remove a stocking or a sample entered by mistake (tap twice). */
export function RemoveRow({ id, what }: { id: string; what: "stocking" | "sample" }) {
  const t = useTranslations("farm.fish")
  const [armed, setArmed] = useState(false)
  const { pending, error, run } = useRun()
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => (armed ? run(() => (what === "stocking" ? removeStockingAction(id) : removeSampleAction(id))) : setArmed(true))}
        className={cn("rounded-lg px-2 py-1 text-sm font-medium", armed ? "bg-destructive text-white" : "text-muted-foreground hover:bg-accent")}
      >
        {armed ? t("removeSure") : t("remove")}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}

/** The pond is empty: close the cycle on a day; or open a closed one again. */
export function CycleClose({ cycleId, closed, today }: { cycleId: string; closed: boolean; today: string }) {
  const t = useTranslations("farm.fish")
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const { pending, error, run } = useRun()
  if (closed)
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" variant="outline" className="h-11 self-start" disabled={pending} onClick={() => run(() => reopenCycleAction(cycleId))}>
          {t("reopen")}
        </Button>
        <ErrorLine text={error} />
      </div>
    )
  if (!open)
    return (
      <Button type="button" variant="outline" className="h-11 self-start" onClick={() => setOpen(true)}>
        {t("close")}
      </Button>
    )
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <p className="text-sm text-muted-foreground">{t("closeHint")}</p>
      <label className={field}>
        {t("closeOn")}
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 font-normal" />
      </label>
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" className="h-11" disabled={pending} onClick={() => run(() => closeCycleAction({ cycleId, date }))}>
          {t("close")}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  )
}
