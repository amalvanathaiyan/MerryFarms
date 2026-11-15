"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buyInputAction, countInputAction, removeUseAction, saveInputAction, setInputRetiredAction, takeOutInputAction } from "@/app/actions/inputs"
import { INPUT_KINDS, INPUT_UNITS } from "@/domain/inputs"
import { formatRupees } from "@/domain/money"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

const field = "flex flex-col gap-1.5 text-sm font-semibold"
const chip = (on: boolean) => cn("min-h-11 rounded-xl border-2 px-3 text-sm font-semibold", on ? "border-primary bg-accent" : "bg-card hover:border-primary")
const numberOrNull = (s: string) => (s.trim() === "" ? null : Number(s))

function useRun() {
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void, kind: "settings" | "expense" = "settings", values?: Record<string, string>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      after?.()
      cheer(kind, values)
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

export interface InputRow {
  id: string
  name: string
  kind: string
  unit: string
  lowAt: number | null
  batchFeed: boolean
}

/** An item: its name, what kind, the unit it's counted in, when to warn, and (poultry) whether hens eat it. */
function InputForm({ item, poultry, onDone }: { item: InputRow | null; poultry: boolean; onDone: () => void }) {
  const t = useTranslations("farm.store")
  const [f, setF] = useState({ name: item?.name ?? "", kind: item?.kind ?? "feed", unit: item?.unit ?? "kg", lowAt: item?.lowAt != null ? String(item.lowAt) : "", batchFeed: item?.batchFeed ?? false })
  const { pending, error, run } = useRun()
  const canFeedHens = poultry && f.kind === "feed" && f.unit === "kg"
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveInputAction({ id: item?.id ?? null, name: f.name, kind: f.kind, unit: f.unit, lowAt: numberOrNull(f.lowAt), batchFeed: canFeedHens && f.batchFeed }), onDone)
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("kind")}</legend>
        <div className="flex flex-wrap gap-2">
          {INPUT_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={f.kind === k} className={chip(f.kind === k)} onClick={() => setF({ ...f, kind: k })}>
              {t(`kind_${k}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={field}>
        {t("name")}
        <Input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t(`namePlaceholder_${f.kind}`)} className="h-12 font-normal" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("unit")}
          <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="h-12 rounded-md border bg-background px-3 text-base font-normal">
            {INPUT_UNITS.map((u) => (
              <option key={u} value={u}>
                {t(`unit_${u}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          {t("lowAt")}
          <Input type="number" min={0} step="any" inputMode="decimal" value={f.lowAt} onChange={(e) => setF({ ...f, lowAt: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      {canFeedHens && (
        <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
          <input type="checkbox" checked={f.batchFeed} onChange={(e) => setF({ ...f, batchFeed: e.target.checked })} className="mt-0.5 size-5" />
          <span>
            <span className="block font-semibold">{t("batchFeed")}</span>
            <span className="text-muted-foreground">{t("batchFeedHint")}</span>
          </span>
        </label>
      )}
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {item ? t("save") : t("addItem")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

export function AddInput({ poultry }: { poultry: boolean }) {
  const t = useTranslations("farm.store")
  const [open, setOpen] = useState(false)
  return open ? (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <InputForm item={null} poultry={poultry} onDone={() => setOpen(false)} />
    </section>
  ) : (
    <Button type="button" variant="outline" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
      <Plus aria-hidden /> {t("addItem")}
    </Button>
  )
}

type Place = { id: string; name: string }
type Move = "buy" | "use" | "count"

/**
 * What happened to an item, one at a time: bought (spending in Money too), used (maybe on a place), or counted
 * (what's really there; the store is put right to it).
 */
export function StoreMoves({ item, left, places, today }: { item: { id: string; unit: string }; left: number; places: Place[]; today: string }) {
  const t = useTranslations("farm.store")
  const [move, setMove] = useState<Move>("buy")
  const [v, setV] = useState({ quantity: "", amount: "", date: today, placeId: "", note: "" })
  const { pending, error, run } = useRun()
  const unit = t(`unit_${item.unit}`)
  const q = Number(v.quantity)
  const reset = () => setV({ ...v, quantity: "", amount: "", note: "" })
  const submit = () => {
    if (move === "buy")
      return run(() => buyInputAction({ inputId: item.id, date: v.date, quantity: q, amountRupees: Number(v.amount), note: v.note.trim() || null }), reset, "expense", { amount: formatRupees(Math.round(Number(v.amount) * 100)) })
    if (move === "use") return run(() => takeOutInputAction({ inputId: item.id, date: v.date, quantity: q, placeId: v.placeId || null, note: v.note.trim() || null }), reset)
    return run(() => countInputAction({ inputId: item.id, counted: q }), reset)
  }
  const ready = move === "count" ? v.quantity.trim() !== "" && q >= 0 : q > 0 && (move !== "buy" || Number(v.amount) > 0)
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("movesTitle")}>
        {(["buy", "use", "count"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={move === m} className={chip(move === m)} onClick={() => setMove(m)}>
            {t(`move_${m}`)}
          </button>
        ))}
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            {move === "count" ? t("countedQty", { unit }) : t("qty", { unit })}
            <Input required type="number" min={0} step="any" inputMode="decimal" value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} placeholder={move === "count" ? String(Math.max(0, left)) : undefined} className="h-12 font-normal tabular-nums" />
          </label>
          {move === "buy" ? (
            <label className={field}>
              {t("paid")}
              <Input required type="number" min={1} step="any" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className="h-12 font-normal tabular-nums" />
            </label>
          ) : move === "use" ? (
            <label className={field}>
              {t("date")}
              <Input type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="h-12 font-normal" />
            </label>
          ) : null}
        </div>
        {move === "buy" && (
          <label className={field}>
            {t("date")}
            <Input type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className="h-12 max-w-48 font-normal" />
          </label>
        )}
        {move === "use" && places.length > 0 && (
          <select value={v.placeId} onChange={(e) => setV({ ...v, placeId: e.target.value })} aria-label={t("usedOn")} className="h-12 rounded-md border bg-background px-3">
            <option value="">{t("usedOnFarm")}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {t("usedOnPlace", { place: p.name })}
              </option>
            ))}
          </select>
        )}
        {move !== "count" && <Input maxLength={80} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={t("note")} className="h-11" />}
        <p className="text-xs text-muted-foreground">{t(`moveHint_${move}`)}</p>
        <ErrorLine text={error} />
        <Button type="submit" size="lg" className="h-12" disabled={pending || !ready}>
          {t(`moveButton_${move}`)}
        </Button>
      </form>
    </section>
  )
}

export function RemoveUse({ id }: { id: string }) {
  const t = useTranslations("farm.store")
  const [armed, setArmed] = useState(false)
  const { pending, run } = useRun()
  return armed ? (
    <Button type="button" variant="destructive" size="sm" className="h-9" disabled={pending} onClick={() => run(() => removeUseAction(id))}>
      {t("removeSure")}
    </Button>
  ) : (
    <button type="button" className="grid size-9 place-items-center rounded-lg text-muted-foreground" aria-label={t("removeUse")} onClick={() => setArmed(true)}>
      <Trash2 className="size-4" />
    </button>
  )
}

/** Change an item, or stop keeping it (or keep it again). */
export function InputActions({ item, poultry, retired }: { item: InputRow; poultry: boolean; retired: boolean }) {
  const t = useTranslations("farm.store")
  const [editing, setEditing] = useState(false)
  const { pending, error, run } = useRun()
  if (editing) return <InputForm item={item} poultry={poultry} onDone={() => setEditing(false)} />
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {!retired && (
          <Button type="button" variant="outline" className="h-10" onClick={() => setEditing(true)}>
            {t("change")}
          </Button>
        )}
        <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => run(() => setInputRetiredAction(item.id, !retired))}>
          {retired ? t("keepAgain") : t("retire")}
        </Button>
      </div>
      <ErrorLine text={error} />
    </div>
  )
}
