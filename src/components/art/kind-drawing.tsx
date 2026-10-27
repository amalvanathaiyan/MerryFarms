import type { ArtKind } from "@/domain/product-art"
import { cn } from "@/lib/utils"
import { KIND_DRAWINGS } from "./kind-drawings"

/** A small line drawing of a product type (egg basket, milk can, keerai bunch…), in the text colour. Decorative. */
export function KindDrawing({ kind, className }: { kind: ArtKind; className?: string }) {
  const { vb, d } = KIND_DRAWINGS[kind]
  return (
    <svg viewBox={vb} className={cn("shrink-0", className)} aria-hidden fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
