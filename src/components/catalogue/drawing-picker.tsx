"use client"

import { useLocale } from "next-intl"
import { DRAWING_GROUPS } from "@/components/art/drawing-library"
import { ART_KINDS } from "@/domain/product-art"
import { ProductPicture } from "@/components/product-picture"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"

/**
 * Pick the picture for a product kind or category: the 14 coloured pictures first, then every drawing in the
 * library by group (goat, prawn, jasmine, tractor…). Scrolls in its own box so the form stays short.
 */
export function DrawingPicker({ value, onChange, label }: { value: string; onChange: (id: string) => void; label: string }) {
  const locale = useLocale()
  const tile = (id: string, name: string) => (
    <button
      key={id}
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={cn("rounded-xl border-2 p-0.5", value === id ? "border-primary" : "border-transparent hover:border-primary/40")}
    >
      <ProductPicture src={null} kind={id} alt="" className="size-11" />
    </button>
  )
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="flex items-center gap-2 text-sm">
        <ProductPicture src={null} kind={value} alt="" className="size-14" />
      </div>
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl border p-2">
        <div className="flex flex-wrap gap-1">{ART_KINDS.map((k) => tile(k, k))}</div>
        {DRAWING_GROUPS.map((g) => (
          <div key={g.key} className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">{pick(locale, g.ta, g.en)}</span>
            <div className="flex flex-wrap gap-1">{g.items.map((d) => tile(d.id, pick(locale, d.ta, d.en)))}</div>
          </div>
        ))}
      </div>
    </fieldset>
  )
}
