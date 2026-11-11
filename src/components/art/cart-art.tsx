import { cn } from "@/lib/utils"

const SOURCES = {
  /** The cart on the road with the farmland behind: welcome screens and banners. */
  scene: "/art/cart-scene.svg",
  /** The cart alone, transparent: order placed, empty states, anywhere on a coloured ground. */
  plain: "/art/cart.svg",
  /** Line only: print and one-colour use. */
  line: "/art/cart-line.svg",
} as const
const SIZES = { scene: [640, 340], plain: [548, 250], line: [640, 340] } as const

/**
 * FarmForYou's bullock cart as a picture file, for pages without the live drawing (sign-in, offline): the same
 * cart as the farm pictures (FarmScene), in daylight and still. scene/plain come from scripts/art/cart-files.ts;
 * line from scripts/art/cart-art.mjs. Decorative by default (empty alt); pass alt where it carries meaning.
 */
export function CartArt({ variant = "plain", alt = "", className, priority }: { variant?: keyof typeof SOURCES; alt?: string; className?: string; priority?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG; next/image adds nothing for vector art
    <img
      src={SOURCES[variant]}
      alt={alt}
      width={SIZES[variant][0]}
      height={SIZES[variant][1]}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("h-auto w-full select-none", className)}
      draggable={false}
    />
  )
}
