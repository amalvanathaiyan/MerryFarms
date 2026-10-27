import type { ArtKind } from "@/domain/product-art"
import { cn } from "@/lib/utils"

/**
 * A product's photo, or a soft drawing of its type (eggs, milk, oil, vegetables…) until
 * the farm adds one.
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
      {DRAWINGS[kind]()}
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

const Shadow = () => <ellipse cx="40" cy="67" rx="24" ry="4.5" fill="#dbe7d2" />

function MilkBottle() {
  return (
    <g>
      <Shadow />
      <path d="M33 18 H47 V26 C47 29 53 31 53 38 V62 C53 64 51 66 49 66 H31 C29 66 27 64 27 62 V38 C27 31 33 29 33 26 Z" fill="#fbfdff" stroke="#c9d6e0" strokeWidth="1.4" />
      <rect x="32" y="13" width="16" height="6" rx="2" fill="#5b8fc7" />
      <path d="M28 44 H52 V62 C52 63.5 50.5 65 49 65 H31 C29.5 65 28 63.5 28 62 Z" fill="#eef4fb" />
      <path d="M33 47 h14" stroke="#9bb8d6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="35" cy="36" r="2" fill="#ffffff" />
    </g>
  )
}

function GheeJar() {
  return (
    <g>
      <Shadow />
      <rect x="22" y="30" width="36" height="35" rx="7" fill="#f4d58a" stroke="#d9b45c" strokeWidth="1.4" />
      <rect x="22" y="30" width="36" height="9" rx="4" fill="#fbe7b0" />
      <rect x="20" y="22" width="40" height="10" rx="3" fill="#c98e3a" />
      <rect x="29" y="44" width="22" height="12" rx="2" fill="#fffaf0" opacity="0.9" />
      <path d="M33 50 h14" stroke="#d9b45c" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function OilBottle() {
  return (
    <g>
      <Shadow />
      <path d="M35 12 H45 V22 C45 25 52 28 52 35 V62 C52 64 50 66 48 66 H32 C30 66 28 64 28 62 V35 C28 28 35 25 35 22 Z" fill="#f2c94c" stroke="#c99a1e" strokeWidth="1.4" />
      <rect x="34" y="9" width="12" height="5" rx="1.5" fill="#6aa368" />
      <rect x="31" y="40" width="18" height="14" rx="2" fill="#fffaf0" opacity="0.9" />
      <path d="M40 43 C37 47 37 50 40 51 C43 50 43 47 40 43 Z" fill="#e0a92b" />
      <path d="M32 32 C32 29 34 28 35 27" stroke="#fff6d6" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Vegetables() {
  return (
    <g>
      <Shadow />
      <path d="M44 30 C56 26 66 36 62 48 C58 60 44 62 40 54 C36 46 36 33 44 30 Z" fill="#7d4e9e" />
      <path d="M44 30 C42 26 45 22 49 23 C47 26 47 28 48 30 Z" fill="#5b8d4a" />
      <circle cx="29" cy="50" r="13" fill="#e2553f" />
      <path d="M24 38 L29 41 L34 38 L31 43 L27 43 Z" fill="#5b8d4a" />
      <circle cx="25" cy="46" r="2.5" fill="#f08a76" />
      <path d="M48 40 C50 39 53 40 54 42" stroke="#a37cc0" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Greens() {
  return (
    <g>
      <Shadow />
      <path d="M40 66 C40 52 40 40 40 30" stroke="#4f7d3c" strokeWidth="2.5" />
      <path d="M40 46 C28 46 20 36 22 22 C34 24 40 32 40 46 Z" fill="#6aa368" />
      <path d="M40 46 C52 46 60 36 58 22 C46 24 40 32 40 46 Z" fill="#5b9a55" />
      <path d="M40 34 C34 26 36 16 40 12 C44 16 46 26 40 34 Z" fill="#7fb874" />
      <path d="M40 46 C33 40 28 33 25 25 M40 46 C47 40 52 33 55 25" stroke="#3f6b30" strokeWidth="1" fill="none" opacity="0.6" />
      <rect x="36" y="56" width="8" height="5" rx="1.5" fill="#c99464" />
    </g>
  )
}

function Fruits() {
  return (
    <g>
      <Shadow />
      <path d="M18 40 C22 56 40 66 58 58 C48 58 30 54 24 38 Z" fill="#f2c94c" stroke="#c99a1e" strokeWidth="1.2" />
      <path d="M22 38 C20 36 18 37 18 40" stroke="#6b5222" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M46 24 C58 22 66 34 60 46 C55 55 42 54 38 46 C34 37 38 26 46 24 Z" fill="#f29d38" />
      <path d="M46 24 C50 27 56 28 60 32 C56 26 52 24 46 24 Z" fill="#e2553f" opacity="0.6" />
      <path d="M46 24 C46 20 49 17 53 17 C51 20 49 22 46 24 Z" fill="#5b8d4a" />
    </g>
  )
}

function Grains() {
  return (
    <g>
      <Shadow />
      <path d="M22 30 C22 24 28 22 30 22 H50 C52 22 58 24 58 30 L60 60 C60 64 56 66 52 66 H28 C24 66 20 64 20 60 Z" fill="#e6d3ad" stroke="#c4a97a" strokeWidth="1.4" />
      <path d="M26 22 C30 30 50 30 54 22" fill="#f6efe0" stroke="#c4a97a" strokeWidth="1.2" />
      <path d="M30 24 C34 20 46 20 50 24" stroke="#c4a97a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {[[34, 44], [40, 42], [46, 45], [37, 50], [43, 51], [40, 56]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="2.4" ry="1.5" fill="#fffaf0" stroke="#c4a97a" strokeWidth="0.8" />
      ))}
    </g>
  )
}

function HoneyJar() {
  return (
    <g>
      <Shadow />
      <path d="M24 32 C24 28 26 26 30 26 H50 C54 26 56 28 56 32 V60 C56 64 53 66 50 66 H30 C27 66 24 64 24 60 Z" fill="#f0a83b" stroke="#c97f1c" strokeWidth="1.4" />
      <rect x="26" y="19" width="28" height="8" rx="3" fill="#c98e3a" />
      <path d="M24 34 C30 38 34 33 40 37 C46 41 50 35 56 37" stroke="#f7c46a" strokeWidth="3" fill="none" />
      <path d="M33 45 l4 -2.5 4 2.5 v5 l-4 2.5 -4 -2.5 Z M41 45 l4 -2.5 4 2.5 v5 l-4 2.5 -4 -2.5 Z" fill="#f7c46a" opacity="0.8" />
      <path d="M58 14 L50 30" stroke="#8a5a3b" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
}

function Spices() {
  return (
    <g>
      <Shadow />
      {[
        [24, "#e9b824"],
        [40, "#d6544a"],
        [56, "#6b4a33"],
      ].map(([x, c], i) => (
        <g key={i}>
          <path d={`M${Number(x) - 11} 48 C${Number(x) - 11} 60 ${Number(x) + 11} 60 ${Number(x) + 11} 48 Z`} fill="#c99464" />
          <path d={`M${Number(x) - 10} 48 C${Number(x) - 7} 39 ${Number(x) + 7} 39 ${Number(x) + 10} 48 Z`} fill={String(c)} />
        </g>
      ))}
    </g>
  )
}

function PickleJar() {
  return (
    <g>
      <Shadow />
      <path d="M25 30 H55 V60 C55 64 52 66 48 66 H32 C28 66 25 64 25 60 Z" fill="#fbfdff" stroke="#c9d6e0" strokeWidth="1.4" />
      <path d="M26 40 H54 V60 C54 63 51 65 48 65 H32 C29 65 26 63 26 60 Z" fill="#c8472f" />
      <circle cx="33" cy="48" r="3" fill="#e9b824" />
      <circle cx="44" cy="53" r="3.5" fill="#e9b824" />
      <circle cx="38" cy="58" r="2.5" fill="#7a9e3a" />
      <path d="M21 26 C21 20 59 20 59 26 L57 31 H23 Z" fill="#e2553f" />
      <path d="M22 30 H58" stroke="#a8714c" strokeWidth="2" />
    </g>
  )
}

function Sapling() {
  return (
    <g>
      <Shadow />
      <path d="M27 48 H53 L50 66 H30 Z" fill="#c26b3e" />
      <rect x="25" y="44" width="30" height="6" rx="2" fill="#a8562c" />
      <path d="M40 44 V26" stroke="#4f7d3c" strokeWidth="2.5" />
      <path d="M40 34 C30 34 25 27 26 18 C35 19 40 25 40 34 Z" fill="#6aa368" />
      <path d="M40 30 C49 30 54 24 53 15 C45 16 40 21 40 30 Z" fill="#7fb874" />
    </g>
  )
}

const DRAWINGS: Record<ArtKind, () => React.ReactElement> = {
  egg: Eggs,
  chicken: Hen,
  milk: MilkBottle,
  dairy: GheeJar,
  oil: OilBottle,
  vegetables: Vegetables,
  greens: Greens,
  fruits: Fruits,
  grains: Grains,
  honey: HoneyJar,
  spices: Spices,
  pickles: PickleJar,
  plants: Sapling,
  basket: Basket,
}
