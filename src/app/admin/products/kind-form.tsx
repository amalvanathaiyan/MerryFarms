"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addStarterKindsAction, retireKindAction, saveKindAction } from "@/app/actions/product-kinds"
import { DrawingPicker } from "@/components/catalogue/drawing-picker"
import { MODULE_KEYS, type ModuleKey } from "@/domain/modules"
import { MEASURES, type DetailDef, type Measure, type PackDef } from "@/domain/product-kinds"
import { cleanPacks, DetailsEditor, PacksEditor, withKeys, type DraftDetail } from "@/components/catalogue/kind-editors"
import { ProductPicture } from "@/components/product-picture"

export interface KindView {
  id: string | null
  module: ModuleKey
  nameTa: string
  nameEn: string
  /** One of the 14 coloured pictures, or any library drawing (src/components/art/drawing-library.ts). */
  art: string
  measure: Measure
  packs: PackDef[]
  details: DetailDef[]
  weighedOnDelivery: boolean
  shelfLifeDays: number | null
  hsn: string | null
  gstRate: 0 | 5 | 12 | 18
  retired: boolean
}

const label = "flex flex-col gap-1.5 text-sm font-semibold"
const select = "h-10 rounded-md border border-input bg-transparent px-2 font-normal"

/** One product kind: its summary, and the form to change it (or a new one when id is null). */
export function KindCard({ kind }: { kind: KindView }) {
  const t = useTranslations("kinds")
  const tm = useTranslations("modules")
  const te = useTranslations("errors")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [k, setK] = useState(kind)
  const [details, setDetails] = useState<DraftDetail[]>(kind.details)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!open && !kind.id) {
    return (
      <li>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Plus aria-hidden /> {t("newKind")}
        </Button>
      </li>
    )
  }

  if (!open) {
    return (
      <li className="flex items-start gap-3 rounded-2xl border bg-card p-3">
        <ProductPicture src={null} kind={kind.art} alt="" className="size-12" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {kind.nameEn} · {kind.nameTa}
            {kind.retired && <span className="ml-2 rounded-full bg-muted px-2 text-xs text-muted-foreground">{t("retired")}</span>}
          </div>
          <div className="text-sm text-muted-foreground">
            {t(`measure_${kind.measure}`)}
            {kind.packs.length > 0 && ` · ${kind.packs.map((p) => p.en).join(", ")}`}
          </div>
          {kind.details.length > 0 && <div className="text-sm text-muted-foreground">{t("asks", { list: kind.details.map((d) => d.en).join(", ") })}</div>}
        </div>
        <Button variant="link" onClick={() => setOpen(true)}>
          {t("edit")}
        </Button>
      </li>
    )
  }

  return (
    <li>
      <form
        className="flex flex-col gap-4 rounded-2xl border-2 border-primary bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          start(async () => {
            const r = await saveKindAction(kind.id, { ...k, packs: cleanPacks(k.packs), details: withKeys(details), hsn: k.hsn?.trim() || null })
            if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
            if (!kind.id) {
              setK(kind)
              setDetails([])
            }
            setOpen(false)
            router.refresh()
          })
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            {t("nameTa")}
            <Input required lang="ta" value={k.nameTa} onChange={(e) => setK({ ...k, nameTa: e.target.value })} className="font-normal" />
          </label>
          <label className={label}>
            {t("nameEn")}
            <Input required lang="en" value={k.nameEn} onChange={(e) => setK({ ...k, nameEn: e.target.value })} className="font-normal" />
          </label>
          <label className={label}>
            {t("module")}
            <select className={select} value={k.module} onChange={(e) => setK({ ...k, module: e.target.value as ModuleKey })}>
              {MODULE_KEYS.filter((m) => m !== "core").map((m) => (
                <option key={m} value={m}>
                  {tm(m)}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {t("measure")}
            <select className={select} value={k.measure} onChange={(e) => setK({ ...k, measure: e.target.value as Measure })}>
              {MEASURES.map((m) => (
                <option key={m} value={m}>
                  {t(`measure_${m}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DrawingPicker label={t("drawing")} value={k.art} onChange={(art) => setK({ ...k, art })} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t("packs")}</legend>
          <PacksEditor packs={k.packs} onChange={(packs) => setK({ ...k, packs })} />
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t("details")}</legend>
          <p className="text-sm text-muted-foreground">{t("detailsHint")}</p>
          <DetailsEditor details={details} onChange={setDetails} />
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={label}>
            {t("shelfLife")}
            <Input type="number" min={0} max={3650} inputMode="numeric" value={k.shelfLifeDays ?? ""} onChange={(e) => setK({ ...k, shelfLifeDays: e.target.value ? Math.round(Number(e.target.value)) : null })} className="font-normal" />
          </label>
          <label className={label}>
            HSN
            <Input inputMode="numeric" maxLength={8} value={k.hsn ?? ""} onChange={(e) => setK({ ...k, hsn: e.target.value.replace(/\D/g, "") || null })} className="font-normal" />
          </label>
          <label className={label}>
            GST
            <select className={select} value={k.gstRate} onChange={(e) => setK({ ...k, gstRate: Number(e.target.value) as KindView["gstRate"] })}>
              {[0, 5, 12, 18].map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-5 accent-[hsl(var(--primary))]" checked={k.weighedOnDelivery} onChange={(e) => setK({ ...k, weighedOnDelivery: e.target.checked })} />
          <span>
            <b>{t("weighed")}</b> <span className="text-muted-foreground">{t("weighedHint")}</span>
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {t("save")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => (setK(kind), setDetails(kind.details), setOpen(false))}>
            {t("cancel")}
          </Button>
          {kind.id && (
            <Button
              type="button"
              variant="outline"
              className="ml-auto"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await retireKindAction(kind.id!, !kind.retired)
                  setOpen(false)
                  router.refresh()
                })
              }
            >
              {kind.retired ? t("restore") : t("retire")}
            </Button>
          )}
        </div>
      </form>
    </li>
  )
}

/** Loads the starter list (kinds already there are left as they are). */
export function StarterKindsButton({ label }: { label: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await addStarterKindsAction()
          router.refresh()
        })
      }
    >
      {label}
    </Button>
  )
}
