"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ArrowDown, ArrowUp, Camera, Minus, Pencil, Plus, Tag, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addCategory,
  bulkAdjustPrices,
  deleteCategory,
  deleteProduct,
  endOffer,
  moveCategory,
  moveProduct,
  quickUpdateProduct,
  removeProductPhoto,
  renameCategory,
  saveProduct,
  setProductPhoto,
  type ActionResult,
} from "@/app/actions/catalogue"
import { adjustPrice, type Adjust } from "@/domain/offers"
import { formatRupees } from "@/domain/money"
import { dayLabel } from "@/lib/i18n-helpers"
import { ProductPicture } from "@/components/product-picture"
import { ART_KINDS, artFor, artKind, STARTER_CATEGORIES, type ArtKind } from "@/domain/product-art"
import { shrinkPhoto } from "@/lib/shrink-photo"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"

type Category = { id: string; nameTa: string; nameEn: string; kind: string | null }
type Product = {
  id: string
  categoryId: string
  nameTa: string
  nameEn: string
  packTa: string
  packEn: string
  noteTa: string
  noteEn: string
  priceRupees: number
  stockQty: number
  stockUnit: string
  gstRate: 0 | 5 | 12 | 18
  hsn: string
  isActive: boolean
  imageUrl: string | null
  /** Offer price in rupees, or null. */
  offerRupees: number | null
  offerEndsOn: string
  /** The offer applies today. */
  offerLive: boolean
}
type Draft = Omit<Product, "id" | "imageUrl" | "offerLive"> & { id?: string }

const UNITS = ["packs", "kg", "grams", "litres", "ml", "bottles", "jars", "pieces", "dozen", "bunches", "trays", "boxes", "bags", "birds"]

export function CatalogueManager({
  categories,
  products,
  canEdit,
  tracksStock,
  today,
}: {
  categories: Category[]
  products: Product[]
  canEdit: boolean
  tracksStock: boolean
  /** IST "YYYY-MM-DD", for offer end dates. */
  today: string
}) {
  const t = useTranslations("farm.catalogue")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const tu = useTranslations("farm.units")
  const unitName = (u: string) => (tu.has(u) ? tu(u) : u)
  const locale = useLocale()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [cat, setCat] = useState<{ id?: string; nameTa: string; nameEn: string; kind?: ArtKind } | null>(null)
  const [bulk, setBulk] = useState<(Adjust & { categoryId: string }) | null>(null)
  const dayText = (d: string) => dayLabel(d, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const [armedDelete, setArmedDelete] = useState(false)

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })

  const blank = (): Draft => ({
    categoryId: categories[0]?.id ?? "",
    nameTa: "",
    nameEn: "",
    packTa: "",
    packEn: "",
    noteTa: "",
    noteEn: "",
    priceRupees: 0,
    stockQty: 0,
    stockUnit: "packs",
    gstRate: 0,
    hsn: "",
    isActive: true,
    offerRupees: null,
    offerEndsOn: "",
  })

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
          run(() => saveProduct({ ...draft, noteTa: draft.noteTa || undefined, noteEn: draft.noteEn || undefined, hsn: draft.hsn || undefined, offerRupees: draft.offerRupees || null }), () => setDraft(null))
        }}
      >
        <h2 className="text-lg font-semibold">{draft.id ? t("editTitle") : t("addTitle")}</h2>
        {errorBox}
        <Labelled label={t("category")}>
          <select className="h-11 rounded-md border border-input bg-transparent px-3" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(locale, c.nameTa, c.nameEn)}
              </option>
            ))}
          </select>
        </Labelled>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label={t("nameTa")}>
            <Input required lang="ta" value={draft.nameTa} onChange={(e) => set("nameTa", e.target.value)} placeholder="நாட்டுக் கோழி முட்டை" />
          </Labelled>
          <Labelled label={t("nameEn")}>
            <Input required lang="en" value={draft.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="Country eggs" />
          </Labelled>
          <Labelled label={t("packTa")}>
            <Input required lang="ta" value={draft.packTa} onChange={(e) => set("packTa", e.target.value)} placeholder="30 முட்டை" />
          </Labelled>
          <Labelled label={t("packEn")}>
            <Input required lang="en" value={draft.packEn} onChange={(e) => set("packEn", e.target.value)} placeholder="Tray of 30" />
          </Labelled>
          <Labelled label={t("noteTa")}>
            <Input lang="ta" value={draft.noteTa} onChange={(e) => set("noteTa", e.target.value)} />
          </Labelled>
          <Labelled label={t("noteEn")}>
            <Input lang="en" value={draft.noteEn} onChange={(e) => set("noteEn", e.target.value)} />
          </Labelled>
        </div>
        <div className={cn("grid gap-3", tracksStock ? "grid-cols-3" : "grid-cols-1")}>
          <Labelled label={t("price")}>
            <Input required type="number" min={1} step="0.5" inputMode="decimal" value={draft.priceRupees || ""} onChange={(e) => set("priceRupees", Number(e.target.value))} />
          </Labelled>
          {tracksStock && (
          <Labelled label={t("stock")}>
            <Input required type="number" min={0} inputMode="numeric" value={draft.stockQty} onChange={(e) => set("stockQty", Number(e.target.value))} />
          </Labelled>
          )}
          {tracksStock && (
          <Labelled label={t("unit")}>
            <select className="h-9 rounded-md border border-input bg-transparent px-2" value={draft.stockUnit} onChange={(e) => set("stockUnit", e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitName(u)}
                </option>
              ))}
            </select>
          </Labelled>
          )}
        </div>
        <fieldset className="flex flex-col gap-3 rounded-xl border border-dashed p-3">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-semibold">
            <Tag className="size-4" /> {t("offer")}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Labelled label={t("offerPrice")}>
              <Input type="number" min={1} step="0.5" inputMode="decimal" value={draft.offerRupees ?? ""} onChange={(e) => set("offerRupees", e.target.value ? Number(e.target.value) : null)} />
            </Labelled>
            <Labelled label={t("offerEnds")}>
              <Input type="date" min={today} value={draft.offerEndsOn} disabled={!draft.offerRupees} onChange={(e) => set("offerEndsOn", e.target.value)} />
            </Labelled>
          </div>
          <p className="text-sm text-muted-foreground">
            {draft.offerRupees && draft.priceRupees > draft.offerRupees
              ? t("offerPreview", { was: formatRupees(Math.round(draft.priceRupees * 100)), now: formatRupees(Math.round(draft.offerRupees * 100)), pct: Math.round((1 - draft.offerRupees / draft.priceRupees) * 100) })
              : t("offerHint")}
          </p>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Labelled label={t("gst")}>
            <select className="h-9 rounded-md border border-input bg-transparent px-2" value={draft.gstRate} onChange={(e) => set("gstRate", Number(e.target.value) as Draft["gstRate"])}>
              {[0, 5, 12, 18].map((r) => (
                <option key={r} value={r}>
                  {r}%
                </option>
              ))}
            </select>
          </Labelled>
          <Labelled label={t("hsn")}>
            <Input value={draft.hsn} onChange={(e) => set("hsn", e.target.value)} placeholder="0407" />
          </Labelled>
        </div>
        <p className="text-sm text-muted-foreground">{t("gstHint")}</p>
        <label className="flex items-center justify-between gap-3 font-medium">
          {t("showInShop")}
          <input type="checkbox" className="size-6 accent-[hsl(var(--primary))]" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} />
        </label>
        <div className="flex flex-wrap gap-2">
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
              run(() => deleteProduct(draft.id!), () => setDraft(null))
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
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" disabled={categories.length === 0} onClick={() => setDraft(blank())}>
            {t("addProduct")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setCat({ nameTa: "", nameEn: "" })}>
            {t("addCategory")}
          </Button>
        </div>
      )}

      {cat && (
        <form
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault()
            const withKind = { ...cat, kind: cat.kind ?? artKind(cat.nameEn, cat.nameTa) }
            run(() => (cat.id ? renameCategory(withKind) : addCategory(withKind)), () => setCat(null))
          }}
        >
          {!cat.id && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("quickCategories")}</span>
              <div className="flex flex-wrap gap-1.5">
                {STARTER_CATEGORIES.filter((s) => !categories.some((c) => c.nameEn === s.nameEn)).map((s) => (
                  <button key={s.nameEn} type="button" onClick={() => setCat({ nameTa: s.nameTa, nameEn: s.nameEn, kind: s.kind })} className={cn("flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-sm", cat.nameEn === s.nameEn ? "border-primary bg-accent" : "bg-card")}>
                    <ProductPicture src={null} kind={s.kind} alt="" className="size-7 rounded-full" />
                    {pick(locale, s.nameTa, s.nameEn)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Labelled label={t("categoryNameTa")}>
            <Input required lang="ta" value={cat.nameTa} onChange={(e) => setCat({ ...cat, nameTa: e.target.value })} placeholder="செக்கு எண்ணெய்" />
          </Labelled>
          <Labelled label={t("categoryNameEn")}>
            <Input required lang="en" value={cat.nameEn} onChange={(e) => setCat({ ...cat, nameEn: e.target.value })} placeholder="Cold-pressed oils" />
          </Labelled>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("categoryType")}</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {ART_KINDS.map((k) => {
                const chosen = (cat.kind ?? artKind(cat.nameEn, cat.nameTa)) === k
                return (
                  <button key={k} type="button" aria-pressed={chosen} onClick={() => setCat({ ...cat, kind: k })} className={cn("flex flex-col items-center gap-1 rounded-xl border p-1.5 text-xs", chosen ? "border-primary bg-accent font-semibold" : "bg-card")}>
                    <ProductPicture src={null} kind={k} alt="" className="size-10" />
                    {t(`art_${k}`)}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="flex-1">
              {tc("save")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setCat(null)}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      )}

      {categories.length === 0 && <p className="py-6 text-center text-muted-foreground">{t("noCategories")}</p>}

      {categories.map((c, ci) => {
        const list = products.filter((p) => p.categoryId === c.id)
        const icon = "grid size-9 place-items-center rounded-lg border text-muted-foreground disabled:opacity-30"
        return (
          <section key={c.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{pick(locale, c.nameTa, c.nameEn)}</h2>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <button type="button" className={icon} disabled={pending || ci === 0} aria-label={t("moveUp")} onClick={() => run(() => moveCategory(c.id, "up"))}>
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" className={icon} disabled={pending || ci === categories.length - 1} aria-label={t("moveDown")} onClick={() => run(() => moveCategory(c.id, "down"))}>
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" className={icon} aria-label={t("renameCategory")} onClick={() => setCat({ id: c.id, nameTa: c.nameTa, nameEn: c.nameEn, kind: (c.kind as ArtKind | null) ?? undefined })}>
                    <Pencil className="size-4" />
                  </button>
                  {list.length > 0 ? (
                    <button type="button" className={icon} aria-label={t("changePrices")} onClick={() => setBulk({ categoryId: c.id, mode: "pct", direction: "up", amount: 5 })}>
                      <Tag className="size-4" />
                    </button>
                  ) : (
                    <button type="button" className={cn(icon, "text-destructive")} disabled={pending} aria-label={t("deleteCategory")} onClick={() => run(() => deleteCategory(c.id))}>
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {bulk?.categoryId === c.id && (
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed p-3">
                <p className="font-semibold">{t("changePrices")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select className="h-10 rounded-md border border-input bg-transparent px-2" value={bulk.direction} onChange={(e) => setBulk({ ...bulk, direction: e.target.value as Adjust["direction"] })}>
                    <option value="up">{t("raise")}</option>
                    <option value="down">{t("lower")}</option>
                  </select>
                  <Input type="number" min={1} inputMode="decimal" className="h-10 w-20 tabular-nums" value={bulk.amount || ""} onChange={(e) => setBulk({ ...bulk, amount: Number(e.target.value) })} />
                  <select className="h-10 rounded-md border border-input bg-transparent px-2" value={bulk.mode} onChange={(e) => setBulk({ ...bulk, mode: e.target.value as Adjust["mode"] })}>
                    <option value="pct">%</option>
                    <option value="rupees">₹</option>
                  </select>
                </div>
                <ul className="text-sm">
                  {list.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 py-0.5">
                      <span className="truncate">
                        {pick(locale, p.nameTa, p.nameEn)} · {pick(locale, p.packTa, p.packEn)}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatRupees(Math.round(p.priceRupees * 100))} → <b>{bulk.amount > 0 ? formatRupees(adjustPrice(Math.round(p.priceRupees * 100), bulk)) : "—"}</b>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={pending || !(bulk.amount > 0)} onClick={() => run(() => bulkAdjustPrices(bulk), () => setBulk(null))}>
                    {t("applyPrices")}
                  </Button>
                  <Button variant="outline" onClick={() => setBulk(null)}>
                    {tc("cancel")}
                  </Button>
                </div>
              </div>
            )}
            {list.length === 0 && <p className="pt-2 text-sm text-muted-foreground">{t("noProducts")}</p>}
            <ul className="divide-y">
              {list.map((p, pi) => (
                <li key={p.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col items-center gap-1">
                      <ProductPicture src={p.imageUrl} kind={artFor(c.kind, p.nameEn, p.nameTa, c.nameEn, c.nameTa)} alt={pick(locale, p.nameTa, p.nameEn)} className="size-16" />
                      {canEdit && (
                        <label className={cn("flex cursor-pointer items-center gap-1 text-xs font-medium text-primary", pending && "pointer-events-none opacity-50")}>
                          <Camera className="size-3.5" /> {p.imageUrl ? t("changePhoto") : t("addPhoto")}
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              e.target.value = ""
                              if (!file) return
                              run(async () => {
                                try {
                                  return await setProductPhoto({ id: p.id, dataUrl: await shrinkPhoto(file) })
                                } catch {
                                  return { ok: false, error: "photo_type" }
                                }
                              })
                            }}
                          />
                        </label>
                      )}
                      {canEdit && p.imageUrl && (
                        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" disabled={pending} onClick={() => run(() => removeProductPhoto(p.id))}>
                          {t("removePhoto")}
                        </button>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{pick(locale, p.nameTa, p.nameEn)}</div>
                      {p.offerRupees != null && (
                        <div className={cn("mt-0.5 flex flex-wrap items-center gap-1.5 text-sm", !p.offerLive && "text-muted-foreground")}>
                          <span className={cn("rounded-full px-2 text-xs font-semibold", p.offerLive ? "bg-yolk text-yolk-foreground" : "bg-muted")}>
                            <Tag className="mr-0.5 inline size-3" />
                            {p.offerLive ? t("offerOn") : t("offerEnded")}
                          </span>
                          <span className="tabular-nums">
                            {formatRupees(Math.round(p.offerRupees * 100))}
                            {p.offerEndsOn && ` · ${t("until", { day: dayText(p.offerEndsOn) })}`}
                          </span>
                          {canEdit && (
                            <button type="button" className="text-xs underline underline-offset-2" disabled={pending} onClick={() => run(() => endOffer(p.id))}>
                              {t("endOffer")}
                            </button>
                          )}
                        </div>
                      )}
                      <div className={cn("text-sm text-muted-foreground", tracksStock && p.stockQty <= 5 && "font-semibold text-destructive")}>
                        {pick(locale, p.packTa, p.packEn)}
                        {tracksStock && ` · ${t("left", { count: p.stockQty, unit: unitName(p.stockUnit) })}`}
                      </div>
                    </div>
                    <label className="flex shrink-0 flex-col items-center gap-0.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-6 accent-[hsl(var(--primary))]"
                        checked={p.isActive}
                        disabled={!canEdit || pending}
                        aria-label={t("showInShop")}
                        onChange={(e) => run(() => quickUpdateProduct({ id: p.id, isActive: e.target.checked }))}
                      />
                      {p.isActive ? t("inShop") : t("hidden")}
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">₹</span>
                    <Input
                      key={`${p.id}-${p.priceRupees}`}
                      type="number"
                      min={1}
                      step="0.5"
                      inputMode="decimal"
                      defaultValue={p.priceRupees}
                      disabled={!canEdit || pending}
                      aria-label={`${t("price")} ${p.nameEn}`}
                      className="h-10 w-24 tabular-nums"
                      onBlur={(e) => {
                        const v = Number(e.target.value)
                        if (v > 0 && v !== p.priceRupees) run(() => quickUpdateProduct({ id: p.id, priceRupees: v }))
                      }}
                    />
                    {tracksStock && <div className="flex items-center overflow-hidden rounded-lg border">
                      <button type="button" className="grid size-10 place-items-center" disabled={pending || p.stockQty === 0} aria-label="−1" onClick={() => run(() => quickUpdateProduct({ id: p.id, stockQty: p.stockQty - 1 }))}>
                        <Minus className="size-4" />
                      </button>
                      <span className="min-w-10 text-center font-semibold tabular-nums">{p.stockQty}</span>
                      <button type="button" className="grid size-10 place-items-center" disabled={pending} aria-label="+1" onClick={() => run(() => quickUpdateProduct({ id: p.id, stockQty: p.stockQty + 1 }))}>
                        <Plus className="size-4" />
                      </button>
                    </div>}
                    {canEdit && (
                      <div className="ml-auto flex items-center gap-1">
                        <button type="button" className="grid size-9 place-items-center rounded-lg text-muted-foreground disabled:opacity-30" disabled={pending || pi === 0} aria-label={t("moveUp")} onClick={() => run(() => moveProduct(p.id, "up"))}>
                          <ArrowUp className="size-4" />
                        </button>
                        <button type="button" className="grid size-9 place-items-center rounded-lg text-muted-foreground disabled:opacity-30" disabled={pending || pi === list.length - 1} aria-label={t("moveDown")} onClick={() => run(() => moveProduct(p.id, "down"))}>
                          <ArrowDown className="size-4" />
                        </button>
                        <Button variant="link" onClick={() => setDraft(p)}>
                          {tc("edit")}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
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
