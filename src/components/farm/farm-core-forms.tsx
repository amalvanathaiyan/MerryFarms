"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { logAssetWorkAction, retireAssetAction, retirePlaceAction, saveAssetAction, savePlaceAction } from "@/app/actions/farm-core"
import { AREA_UNITS, ASSET_KINDS, isOneOf, LAND_KINDS, PLACE_KINDS, SIZED_KINDS, SOILS, WATER_KINDS } from "@/domain/farm-core"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

const field = "flex flex-col gap-1.5 text-sm font-semibold"
const chip = (on: boolean) => cn("min-h-11 rounded-full border-2 px-3.5 text-sm font-semibold", on ? "border-primary bg-accent" : "bg-card hover:border-primary")
const area = "rounded-xl border bg-card px-3 py-2 text-base font-normal"
const num = (v: string) => (v.trim() && Number(v) > 0 ? Number(v) : null)

function useRun() {
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      after?.()
      cheer("settings")
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

// ── Places ───────────────────────────────────────────────────────────────────

export interface PlaceRow {
  id: string
  kind: string
  name: string
  parentId: string | null
  area: number | null
  areaUnit: string
  surveyNo: string | null
  soil: string | null
  depthFt: number | null
  notes: string | null
}

/**
 * Adds or changes a place. The kind comes first; then only the boxes that kind has: land has a size, survey
 * number and soil (and a plot can sit in a block); a pond has a size; a well or borewell its depth.
 */
export function PlaceForm({ place, blocks, onDone }: { place: PlaceRow | null; blocks: { id: string; name: string }[]; onDone: () => void }) {
  const t = useTranslations("farm.land")
  const [f, setF] = useState({
    kind: place?.kind ?? "block",
    name: place?.name ?? "",
    parentId: place?.parentId ?? "",
    area: place?.area?.toString() ?? "",
    areaUnit: place?.areaUnit ?? "acre",
    surveyNo: place?.surveyNo ?? "",
    soil: place?.soil ?? "",
    depthFt: place?.depthFt?.toString() ?? "",
    notes: place?.notes ?? "",
  })
  const { pending, error, run } = useRun()
  const land = isOneOf(LAND_KINDS, f.kind)
  const sized = isOneOf(SIZED_KINDS, f.kind)
  const water = isOneOf(WATER_KINDS, f.kind)
  const otherBlocks = blocks.filter((b) => b.id !== place?.id)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            savePlaceAction({
              id: place?.id ?? null,
              kind: f.kind,
              name: f.name,
              parentId: f.kind === "plot" && f.parentId ? f.parentId : null,
              area: sized ? num(f.area) : null,
              areaUnit: f.areaUnit,
              surveyNo: land ? f.surveyNo : null,
              soil: land && f.soil ? f.soil : null,
              depthFt: water ? num(f.depthFt) : null,
              notes: f.notes,
            }),
          onDone
        )
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("kind")}</legend>
        <div className="flex flex-wrap gap-2">
          {PLACE_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={f.kind === k} className={chip(f.kind === k)} onClick={() => setF({ ...f, kind: k })}>
              {t(`place_${k}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={field}>
        {t("name")}
        <Input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t(`namePlaceholder_${f.kind}`)} className="h-12 font-normal" />
      </label>
      {f.kind === "plot" && otherBlocks.length > 0 && (
        <label className={field}>
          {t("inBlock")}
          <select value={f.parentId} onChange={(e) => setF({ ...f, parentId: e.target.value })} className="h-12 rounded-md border bg-background px-3 font-normal">
            <option value="">{t("notInBlock")}</option>
            {otherBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {sized && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("size")}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="number" min={0} step="any" inputMode="decimal" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className="h-12 w-28 tabular-nums" aria-label={t("size")} />
            {AREA_UNITS.map((u) => (
              <button key={u} type="button" aria-pressed={f.areaUnit === u} className={chip(f.areaUnit === u)} onClick={() => setF({ ...f, areaUnit: u })}>
                {t(`unit_${u}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {land && (
        <>
          <label className={field}>
            {t("surveyNo")}
            <Input maxLength={40} value={f.surveyNo} onChange={(e) => setF({ ...f, surveyNo: e.target.value })} className="h-12 max-w-56 font-normal" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t("soil")}</legend>
            <div className="flex flex-wrap gap-2">
              {SOILS.map((s) => (
                <button key={s} type="button" aria-pressed={f.soil === s} className={chip(f.soil === s)} onClick={() => setF({ ...f, soil: f.soil === s ? "" : s })}>
                  {t(`soil_${s}`)}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {water && (
        <label className={field}>
          {t("depthFt")}
          <Input type="number" min={0} step="any" inputMode="decimal" value={f.depthFt} onChange={(e) => setF({ ...f, depthFt: e.target.value })} className="h-12 w-28 font-normal tabular-nums" />
        </label>
      )}
      <label className={field}>
        {t("notes")}
        <textarea rows={2} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={area} />
      </label>
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {place ? t("save") : t("addPlace")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

/** "Add a place", folded until wanted. */
export function AddPlace({ blocks }: { blocks: { id: string; name: string }[] }) {
  const t = useTranslations("farm.land")
  const [open, setOpen] = useState(false)
  return open ? (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <PlaceForm place={null} blocks={blocks} onDone={() => setOpen(false)} />
    </section>
  ) : (
    <Button type="button" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
      <Plus aria-hidden /> {t("addPlace")}
    </Button>
  )
}

/** A place's Change and No-longer-used buttons, opening its form in place. */
export function PlaceActions({ place, blocks, retired }: { place: PlaceRow; blocks: { id: string; name: string }[]; retired: boolean }) {
  const t = useTranslations("farm.land")
  const [editing, setEditing] = useState(false)
  const { pending, error, run } = useRun()
  if (editing) return <PlaceForm place={place} blocks={blocks} onDone={() => setEditing(false)} />
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {!retired && (
          <Button type="button" variant="outline" className="h-10" onClick={() => setEditing(true)}>
            {t("change")}
          </Button>
        )}
        <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => run(() => retirePlaceAction(place.id, !retired))}>
          {retired ? t("useAgain") : t("retire")}
        </Button>
      </div>
      <ErrorLine text={error} />
    </div>
  )
}

// ── Assets ───────────────────────────────────────────────────────────────────

export interface AssetRow {
  id: string
  kind: string
  name: string
  placeId: string | null
  boughtOn: string | null
  costPaise: number | null
  serviceEveryDays: number | null
  lastServiceOn: string | null
  notes: string | null
}

const SERVICE_CHOICES = [null, 30, 90, 180, 365] as const

export function AssetForm({ asset, places, today, onDone }: { asset: AssetRow | null; places: { id: string; name: string }[]; today: string; onDone: () => void }) {
  const t = useTranslations("farm.land")
  const [f, setF] = useState({
    kind: asset?.kind ?? "motor",
    name: asset?.name ?? "",
    placeId: asset?.placeId ?? "",
    boughtOn: asset?.boughtOn ?? "",
    cost: asset?.costPaise ? String(asset.costPaise / 100) : "",
    every: asset?.serviceEveryDays ?? null,
    lastServiceOn: asset?.lastServiceOn ?? "",
    notes: asset?.notes ?? "",
  })
  const custom = f.every != null && !(SERVICE_CHOICES as readonly (number | null)[]).includes(f.every)
  const { pending, error, run } = useRun()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            saveAssetAction({
              id: asset?.id ?? null,
              kind: f.kind,
              name: f.name,
              placeId: f.placeId || null,
              boughtOn: f.boughtOn || null,
              costRupees: num(f.cost),
              serviceEveryDays: f.every,
              lastServiceOn: f.every && f.lastServiceOn ? f.lastServiceOn : null,
              notes: f.notes,
            }),
          onDone
        )
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("kind")}</legend>
        <div className="flex flex-wrap gap-2">
          {ASSET_KINDS.map((k) => (
            <button key={k} type="button" aria-pressed={f.kind === k} className={chip(f.kind === k)} onClick={() => setF({ ...f, kind: k })}>
              {t(`asset_${k}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={field}>
        {t("name")}
        <Input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t("assetNamePlaceholder")} className="h-12 font-normal" />
      </label>
      {places.length > 0 && (
        <label className={field}>
          {t("where")}
          <select value={f.placeId} onChange={(e) => setF({ ...f, placeId: e.target.value })} className="h-12 rounded-md border bg-background px-3 font-normal">
            <option value="">{t("wholeFarm")}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("boughtOn")}
          <Input type="date" max={today} value={f.boughtOn} onChange={(e) => setF({ ...f, boughtOn: e.target.value })} className="h-12 font-normal" />
        </label>
        <label className={field}>
          {t("cost")}
          <Input type="number" min={0} step="any" inputMode="decimal" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("serviceEvery")}</legend>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CHOICES.map((d) => (
            <button key={d ?? 0} type="button" aria-pressed={f.every === d} className={chip(f.every === d)} onClick={() => setF({ ...f, every: d })}>
              {d == null ? t("noService") : d >= 365 ? t("everyYear") : t("everyMonths", { count: d / 30 })}
            </button>
          ))}
          <button type="button" aria-pressed={custom} className={chip(custom)} onClick={() => setF({ ...f, every: custom ? f.every : 60 })}>
            {t("everyDaysPick")}
          </button>
        </div>
        {custom && (
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Input type="number" min={1} max={3650} value={f.every ?? ""} onChange={(e) => setF({ ...f, every: Math.max(1, Math.min(3650, Number(e.target.value) || 1)) })} className="h-11 w-24 tabular-nums" />
            {t("days")}
          </label>
        )}
      </fieldset>
      {f.every != null && (
        <label className={field}>
          {t("lastService")}
          <Input type="date" max={today} value={f.lastServiceOn} onChange={(e) => setF({ ...f, lastServiceOn: e.target.value })} className="h-12 max-w-48 font-normal" />
        </label>
      )}
      <label className={field}>
        {t("notes")}
        <textarea rows={2} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={area} placeholder={t("assetNotesPlaceholder")} />
      </label>
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {asset ? t("save") : t("addAsset")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

export function AddAsset({ places, today }: { places: { id: string; name: string }[]; today: string }) {
  const t = useTranslations("farm.land")
  const [open, setOpen] = useState(false)
  return open ? (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <AssetForm asset={null} places={places} today={today} onDone={() => setOpen(false)} />
    </section>
  ) : (
    <Button type="button" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
      <Plus aria-hidden /> {t("addAsset")}
    </Button>
  )
}

/**
 * An asset's buttons: "Repair or service" (date, whether it was the regular service, what it cost), Change, and
 * No longer used. One opens at a time, in place.
 */
export function AssetActions({ asset, places, today, retired }: { asset: AssetRow; places: { id: string; name: string }[]; today: string; retired: boolean }) {
  const t = useTranslations("farm.land")
  const [mode, setMode] = useState<"work" | "edit" | null>(null)
  const [w, setW] = useState({ date: today, service: !!asset.serviceEveryDays, amount: "", note: "" })
  const { pending, error, run } = useRun()
  if (mode === "edit") return <AssetForm asset={asset} places={places} today={today} onDone={() => setMode(null)} />
  if (mode === "work")
    return (
      <form
        className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => logAssetWorkAction({ id: asset.id, date: w.date, service: w.service, amountRupees: num(w.amount), note: w.note || null }), () => setMode(null))
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className={field}>
            {t("workOn")}
            <Input type="date" max={today} value={w.date} onChange={(e) => setW({ ...w, date: e.target.value })} className="h-11 font-normal" />
          </label>
          <label className={field}>
            {t("workCost")}
            <Input type="number" min={0} step="any" inputMode="decimal" value={w.amount} onChange={(e) => setW({ ...w, amount: e.target.value })} className="h-11 font-normal tabular-nums" />
          </label>
        </div>
        {!!asset.serviceEveryDays && (
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={w.service} onChange={(e) => setW({ ...w, service: e.target.checked })} className="size-6 accent-primary" />
            {t("wasService")}
          </label>
        )}
        <Input maxLength={120} value={w.note} onChange={(e) => setW({ ...w, note: e.target.value })} placeholder={t("workNote")} className="h-11" />
        <p className="text-xs text-muted-foreground">{t("workHint")}</p>
        <ErrorLine text={error} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-11" disabled={pending || (!w.service && !num(w.amount))}>
            {t("saveWork")}
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => setMode(null)}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    )
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {!retired && (
          <>
            <Button type="button" className="h-10" onClick={() => setMode("work")}>
              {t("logWork")}
            </Button>
            <Button type="button" variant="outline" className="h-10" onClick={() => setMode("edit")}>
              {t("change")}
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => run(() => retireAssetAction(asset.id, !retired))}>
          {retired ? t("useAgain") : t("retire")}
        </Button>
      </div>
      <ErrorLine text={error} />
    </div>
  )
}
