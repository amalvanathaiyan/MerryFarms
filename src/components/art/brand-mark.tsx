import { cn } from "@/lib/utils"
import { colourName } from "@/domain/brand"
import { FFY_ON_GREEN, FFY_ON_GREEN_SMALL, FFY_ON_LIGHT, FFY_TINY } from "@/components/art/brand-marks.generated"

/** FarmForYou's green, behind its mark on tiles and icons. */
export const FFY_GREEN = "#1E8A4C"

/**
 * FarmForYou's mark: turmeric leaves growing from a smiling turmeric-yellow heart (locked 2026-11-12; drawn by
 * scripts/art/brand/build.cjs). "tile" sits on the green rounded square, like the app icon ("small" for 48 px and
 * below: bolder face, no veins); "light" is the mark alone for light grounds; "tiny" is the simple one beside words.
 * The markup is a fixed drawing from the build, never user input.
 */
export function FfyMark({ tone = "light", small, className, title }: { tone?: "tile" | "light" | "tiny"; small?: boolean; className?: string; title?: string }) {
  const inner = tone === "tile" ? `<rect width="64" height="64" rx="15" fill="${FFY_GREEN}"/>${small ? FFY_ON_GREEN_SMALL : FFY_ON_GREEN}` : tone === "tiny" ? FFY_TINY : FFY_ON_LIGHT
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

/**
 * The farm's name, each word in the farm's name colours in turn (Merry red, Farms green). Each colour shows in its
 * readable version for light or dark mode (--name-N from the root layout's brand CSS); `exact` shows the colours as
 * given, for previews of colours not saved yet.
 */
export function FarmName({ name, colours, className, exact }: { name: string; colours: readonly string[]; className?: string; exact?: boolean }) {
  return (
    <span className={className}>
      {colourName(name, colours).map((p, i) => (
        <span key={i} style={p.colour ? { color: exact ? p.colour : `var(--name-${colours.indexOf(p.colour) + 1}, ${p.colour})` } : undefined}>
          {p.text}
        </span>
      ))}
    </span>
  )
}

/** The small line every farm carries: the tiny mark and "on Farm For You", quieter than the farm's own words. */
export function OnFarmForYou({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium opacity-75", className)} lang="en">
      <FfyMark tone="tiny" className="size-3.5" />
      on Farm For You
    </span>
  )
}
