import type { ArtKind } from "@/domain/product-art"
import { cn } from "@/lib/utils"
import { KIND_DRAWINGS } from "./kind-drawings"
import { DRAWINGS } from "./drawing-library"

/** A small line drawing of a product type (egg basket, milk can, keerai bunch…) or any library drawing a category
 *  chose (goat, prawn…), in the text colour. Decorative. */
export function KindDrawing({ kind, className }: { kind: string; className?: string }) {
  const { vb, d } = KIND_DRAWINGS[kind as ArtKind] ?? DRAWINGS.get(kind) ?? KIND_DRAWINGS.basket
  return (
    <svg viewBox={vb} className={cn("shrink-0", className)} aria-hidden fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
