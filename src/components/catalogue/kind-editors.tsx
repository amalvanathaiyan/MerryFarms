"use client"

import { useTranslations } from "next-intl"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DETAIL_TYPES, detailKey, type DetailDef, type DetailType, type PackDef } from "@/domain/product-kinds"

/** A detail while being edited: a new one has no key yet (it gets one from its English name when saved). */
export type DraftDetail = Omit<DetailDef, "key"> & { key: string }

/** Gives new details a key from their English name, unique among the others; drops empty rows. */
export function withKeys(details: DraftDetail[]): DetailDef[] {
  const out: DetailDef[] = []
  for (const d of details) {
    if (!d.ta.trim() || !d.en.trim()) continue
    const key = d.key || detailKey(d.en, out.map((x) => x.key).concat(details.map((x) => x.key).filter(Boolean)))
    out.push({ ...d, key, choices: d.type === "choice" ? d.choices.filter((c) => c.ta.trim() && c.en.trim()) : [] })
  }
  return out
}

export const cleanPacks = (packs: PackDef[]) => packs.filter((p) => p.ta.trim() && p.en.trim())

const row = "grid grid-cols-[1fr_1fr_auto] items-center gap-2"
const remove = "grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-accent"

/** Pack sizes in Tamil and English (1 கிலோ / 1 kg), added and removed in place. */
export function PacksEditor({ packs, onChange, addLabel }: { packs: PackDef[]; onChange: (p: PackDef[]) => void; addLabel?: string }) {
  const t = useTranslations("kinds")
  return (
    <div className="flex flex-col gap-2">
      {packs.map((p, i) => (
        <div key={i} className={row}>
          <Input lang="ta" aria-label={t("inTamil")} placeholder="1 கிலோ" value={p.ta} onChange={(e) => onChange(packs.map((x, j) => (j === i ? { ...x, ta: e.target.value } : x)))} />
          <Input lang="en" aria-label={t("inEnglish")} placeholder="1 kg" value={p.en} onChange={(e) => onChange(packs.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)))} />
          <button type="button" className={remove} aria-label={t("remove")} onClick={() => onChange(packs.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" className="self-start" onClick={() => onChange([...packs, { ta: "", en: "" }])}>
        <Plus aria-hidden /> {addLabel ?? t("addPack")}
      </Button>
    </div>
  )
}

/** The details asked for each product: name (Tamil, English), what kind of answer, required, shown to customers. */
export function DetailsEditor({ details, onChange }: { details: DraftDetail[]; onChange: (d: DraftDetail[]) => void }) {
  const t = useTranslations("kinds")
  const set = (i: number, d: Partial<DraftDetail>) => onChange(details.map((x, j) => (j === i ? { ...x, ...d } : x)))
  return (
    <div className="flex flex-col gap-3">
      {details.map((d, i) => (
        <fieldset key={i} className="flex flex-col gap-2 rounded-xl border p-3">
          <div className={row}>
            <Input lang="ta" aria-label={t("detailTa")} placeholder="முட்டை வகை" value={d.ta} onChange={(e) => set(i, { ta: e.target.value })} />
            <Input lang="en" aria-label={t("detailEn")} placeholder="Egg type" value={d.en} onChange={(e) => set(i, { en: e.target.value })} />
            <button type="button" className={remove} aria-label={t("remove")} onClick={() => onChange(details.filter((_, j) => j !== i))}>
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              {t("answer")}
              <select className="h-10 rounded-md border border-input bg-transparent px-2" value={d.type} onChange={(e) => set(i, { type: e.target.value as DetailType })}>
                {DETAIL_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {t(`type_${x}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-5 accent-[hsl(var(--primary))]" checked={d.required} onChange={(e) => set(i, { required: e.target.checked })} />
              {t("required")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-5 accent-[hsl(var(--primary))]" checked={d.shown} onChange={(e) => set(i, { shown: e.target.checked })} />
              {t("shown")}
            </label>
          </div>
          {d.type === "choice" && (
            <div className="flex flex-col gap-2 border-l-2 pl-3">
              <span className="text-sm font-semibold">{t("choices")}</span>
              <PacksEditor packs={d.choices} onChange={(choices) => set(i, { choices })} addLabel={t("addChoice")} />
            </div>
          )}
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => onChange([...details, { key: "", ta: "", en: "", type: "choice", choices: [], required: false, shown: true }])}
      >
        <Plus aria-hidden /> {t("addDetail")}
      </Button>
    </div>
  )
}
