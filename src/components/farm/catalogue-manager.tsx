"use client"

import { useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addCategory, deleteProduct, quickUpdateProduct, saveProduct, type ActionResult } from "@/app/actions/catalogue"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"

type Category = { id: string; nameTa: string; nameEn: string }
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
}
type Draft = Omit<Product, "id"> & { id?: string }

const UNITS = ["packs", "trays", "kg", "birds", "litres", "pieces", "boxes", "jars"]

export function CatalogueManager({ categories, products, canEdit }: { categories: Category[]; products: Product[]; canEdit: boolean }) {
  const t = useTranslations("farm.catalogue")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const locale = useLocale()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [cat, setCat] = useState<{ nameTa: string; nameEn: string } | null>(null)
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
          run(() => saveProduct({ ...draft, noteTa: draft.noteTa || undefined, noteEn: draft.noteEn || undefined, hsn: draft.hsn || undefined }), () => setDraft(null))
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
        <div className="grid grid-cols-3 gap-3">
          <Labelled label={t("price")}>
            <Input required type="number" min={1} step="0.5" inputMode="decimal" value={draft.priceRupees || ""} onChange={(e) => set("priceRupees", Number(e.target.value))} />
          </Labelled>
          <Labelled label={t("stock")}>
            <Input required type="number" min={0} inputMode="numeric" value={draft.stockQty} onChange={(e) => set("stockQty", Number(e.target.value))} />
          </Labelled>
          <Labelled label={t("unit")}>
            <select className="h-9 rounded-md border border-input bg-transparent px-2" value={draft.stockUnit} onChange={(e) => set("stockUnit", e.target.value)}>
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Labelled>
        </div>
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
            run(() => addCategory(cat), () => setCat(null))
          }}
        >
          <Labelled label={t("categoryNameTa")}>
            <Input required lang="ta" value={cat.nameTa} onChange={(e) => setCat({ ...cat, nameTa: e.target.value })} placeholder="முட்டை" />
          </Labelled>
          <Labelled label={t("categoryNameEn")}>
            <Input required lang="en" value={cat.nameEn} onChange={(e) => setCat({ ...cat, nameEn: e.target.value })} placeholder="Eggs" />
          </Labelled>
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

      {categories.map((c) => {
        const list = products.filter((p) => p.categoryId === c.id)
        return (
          <section key={c.id} className="rounded-2xl border bg-card p-4">
            <h2 className="text-lg font-semibold">{pick(locale, c.nameTa, c.nameEn)}</h2>
            {list.length === 0 && <p className="pt-2 text-sm text-muted-foreground">{t("noProducts")}</p>}
            <ul className="divide-y">
              {list.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{pick(locale, p.nameTa, p.nameEn)}</div>
                      <div className={cn("text-sm text-muted-foreground", p.stockQty <= 5 && "font-semibold text-destructive")}>
                        {pick(locale, p.packTa, p.packEn)} · {t("left", { count: p.stockQty, unit: p.stockUnit })}
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
                    <div className="flex items-center overflow-hidden rounded-lg border">
                      <button type="button" className="grid size-10 place-items-center" disabled={pending || p.stockQty === 0} aria-label="−1" onClick={() => run(() => quickUpdateProduct({ id: p.id, stockQty: p.stockQty - 1 }))}>
                        <Minus className="size-4" />
                      </button>
                      <span className="min-w-10 text-center font-semibold tabular-nums">{p.stockQty}</span>
                      <button type="button" className="grid size-10 place-items-center" disabled={pending} aria-label="+1" onClick={() => run(() => quickUpdateProduct({ id: p.id, stockQty: p.stockQty + 1 }))}>
                        <Plus className="size-4" />
                      </button>
                    </div>
                    {canEdit && (
                      <Button variant="link" className="ml-auto" onClick={() => setDraft(p)}>
                        {tc("edit")}
                      </Button>
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
