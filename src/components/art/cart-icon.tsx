import { cn } from "@/lib/utils"

/** A small bullock-cart glyph (roof, bed, big wheel, pole) in the text colour, for "on the way" and delivery hints. */
export function CartIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", className)} style={style} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 11l3 2M4 13h17M6 13V9q0-3 3-3h8q3 0 3 3v4M10 6v7M14 6v7" />
      <circle cx="13" cy="17.5" r="4" />
      <path d="M13 13.5v8M9 17.5h8" />
    </svg>
  )
}
