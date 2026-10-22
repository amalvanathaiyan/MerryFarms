import type { ArtKind } from "@/domain/product-art"
import { cn } from "@/lib/utils"

/**
 * A product's photo, or a soft drawing (eggs, hen or basket) until the farm adds one.
 * Square; size it with className (e.g. "size-20").
 */
export function ProductPicture({ src, kind, alt, className }: { src: string | null; kind: ArtKind; alt: string; className?: string }) {
  const box = cn("shrink-0 overflow-hidden rounded-xl bg-[#eef4e8]", className)
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- small, already-shrunk photos served by our own route
    return <img src={src} alt={alt} loading="lazy" decoding="async" className={cn(box, "object-cover")} />
  }
  return (
    <svg viewBox="0 0 80 80" role="img" aria-label={alt} className={box}>
      {kind === "egg" && <Eggs />}
      {kind === "chicken" && <Hen />}
      {kind === "basket" && <Basket />}
    </svg>
  )
}

function Eggs() {
  return (
    <g>
      <ellipse cx="40" cy="66" rx="26" ry="5" fill="#dbe7d2" />
      <ellipse cx="29" cy="47" rx="11" ry="14" fill="#f3e3c8" stroke="#d9c39d" strokeWidth="1.2" />
      <ellipse cx="51" cy="47" rx="11" ry="14" fill="#e9cfa6" stroke="#cdb085" strokeWidth="1.2" />
      <ellipse cx="40" cy="55" rx="12" ry="15" fill="#f7ecd9" stroke="#d9c39d" strokeWidth="1.2" />
      <ellipse cx="36" cy="49" rx="3" ry="5" fill="#fffaf1" opacity="0.8" />
      <circle cx="47" cy="40" r="1" fill="#c9a77a" />
      <circle cx="55" cy="50" r="0.8" fill="#c9a77a" />
    </g>
  )
}

function Hen() {
  return (
    <g>
      <ellipse cx="40" cy="68" rx="24" ry="4.5" fill="#dbe7d2" />
      {/* tail */}
      <path d="M22 44 C12 34 14 22 22 20 C22 30 26 36 30 40 Z" fill="#8a5a3b" />
      <path d="M24 46 C16 40 16 30 20 28 C22 36 26 40 30 43 Z" fill="#a8714c" />
      {/* body */}
      <ellipse cx="40" cy="48" rx="19" ry="15" fill="#b9805a" />
      <path d="M30 48 C36 56 46 56 52 49 C48 52 38 53 30 48 Z" fill="#8a5a3b" opacity="0.7" />
      {/* head and neck */}
      <circle cx="56" cy="32" r="8" fill="#b9805a" />
      <path d="M50 36 C52 42 54 44 56 46 L46 44 Z" fill="#b9805a" />
      <path d="M52 24 C53 20 55 21 56 23 C57 20 59 21 60 24 Z" fill="#d6544a" />
      <path d="M63 32 L68 34 L63 36 Z" fill="#e3a23c" />
      <path d="M60 37 C61 40 59 42 58 40 Z" fill="#d6544a" />
      <circle cx="58" cy="31" r="1.4" fill="#2d241e" />
      {/* legs */}
      <path d="M36 62 V67 M44 62 V67" stroke="#e3a23c" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function Basket() {
  return (
    <g>
      <ellipse cx="40" cy="67" rx="25" ry="4.5" fill="#dbe7d2" />
      <path d="M24 38 C24 22 56 22 56 38" fill="none" stroke="#a8714c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="33" cy="38" r="6" fill="#e3a23c" />
      <circle cx="44" cy="36" r="6" fill="#6aa368" />
      <circle cx="51" cy="40" r="5" fill="#d6544a" />
      <path d="M18 40 H62 L57 63 H23 Z" fill="#c99464" />
      <path d="M21 48 H59 M22 55 H58" stroke="#a8714c" strokeWidth="1.5" />
      <path d="M30 40 L32 63 M40 40 V63 M50 40 L48 63" stroke="#a8714c" strokeWidth="1.2" opacity="0.7" />
    </g>
  )
}
