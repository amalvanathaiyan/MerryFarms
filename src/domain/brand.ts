/**
 * A farm's brand on FarmForYou: its name, coloured word by word if it chose colours; its tagline; and the small
 * "on Farm For You" line that every farm carries under its tagline, never louder than the farm's own words.
 * Pure, so it is tested.
 */

/** Animated marks the platform can give a farm for its opening. Drawn in src/components/art/brand-marks.generated.ts. */
export const OPENING_MARKS = ["merry-egg"] as const
export type OpeningMark = (typeof OPENING_MARKS)[number]

export function openingMarkOf(id: string | null | undefined): OpeningMark | null {
  return OPENING_MARKS.find((m) => m === id) ?? null
}

/** Up to three name colours, each a #rrggbb colour. */
export const MAX_NAME_COLOURS = 3
const HEX = /^#[0-9a-f]{6}$/i

export function cleanNameColours(raw: readonly string[]): string[] | null {
  if (raw.length > MAX_NAME_COLOURS) return null
  const out = raw.map((c) => c.trim()).filter(Boolean)
  return out.every((c) => HEX.test(c)) ? out.map((c) => c.toUpperCase()) : null
}

export type NamePart = { text: string; colour: string | null }

/**
 * The name split into words, each word taking the next colour in turn ("Merry" red, "Farms" green).
 * The spaces stay their own parts so the name wraps naturally. With no colours, one plain part.
 */
export function colourName(name: string, colours: readonly string[]): NamePart[] {
  if (!colours.length) return [{ text: name, colour: null }]
  let word = 0
  return name.split(/(\s+)/).filter(Boolean).map((text) => (/^\s+$/.test(text) ? { text, colour: null } : { text, colour: colours[word++ % colours.length] }))
}

const PLATFORM_TAGLINE = /^\s*farm\s*for\s*you\s*$/i

/**
 * Whether the small "on Farm For You" line shows under the farm's tagline. It always does, except when the
 * tagline already is "Farm For You" (a farm run by the platform's own people), so it isn't said twice.
 */
export function showPlatformLine(tagline: string | null | undefined): boolean {
  return !PLATFORM_TAGLINE.test(tagline ?? "")
}

/** The tagline in the reader's language, falling back to the other one. */
export function taglineFor(locale: string, farm: { taglineTa: string | null; taglineEn: string | null }): string | null {
  const ta = farm.taglineTa?.trim() || null
  const en = farm.taglineEn?.trim() || null
  return locale === "ta" ? (ta ?? en) : (en ?? ta)
}
