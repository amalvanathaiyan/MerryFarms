import { cn } from "@/lib/utils"

/** The wheel's 12 spokes, from the hub (r 9) to the felloe (r 20), in a 64×64 box. */
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6
  const at = (r: number) => `${(32 + r * Math.cos(a)).toFixed(1)} ${(32 + r * Math.sin(a)).toFixed(1)}`
  return `M${at(9)}L${at(20)}`
}).join("")
const RIM = "M8 32a24 24 0 1 0 48 0a24 24 0 1 0 -48 0ZM12 32a20 20 0 1 0 40 0a20 20 0 1 0 -40 0Z"
const SPROUT = "M32 33V27M32 29q-4-1-5-5q4 0 5 5M32 28q3-1 4-5q-4 0-4 5"

/**
 * FarmForYou's mark: the bullock cart's wheel with a sprout at the hub (same drawing as public/art/wheel.svg).
 * "tile" sits on a leaf-green rounded square, like the app icon; "plain" takes the text colour, for use beside words.
 */
export function WheelMark({ tone = "plain", className, title }: { tone?: "tile" | "plain"; className?: string; title?: string }) {
  const tile = tone === "tile"
  const fg = tile ? "#FFF1C7" : "currentColor"
  return (
    <svg viewBox="0 0 64 64" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {tile && <rect width="64" height="64" rx="16" fill="#1E6B45" />}
      <path d={RIM} fill={fg} fillRule="evenodd" />
      <path d={SPOKES} stroke={fg} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="7" fill="#F5B700" />
      <path d={SPROUT} fill="none" stroke={tile ? "#1E6B45" : "#16301F"} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
