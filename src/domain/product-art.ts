/**
 * Product pictures: which drawn placeholder fits a product that has no photo yet,
 * and checks on uploaded photos (type by content, not by what the browser claims).
 */

export type ArtKind = "egg" | "chicken" | "basket"

const EGG = /egg|முட்டை/i
const CHICKEN = /chicken|kozhi|hen|broiler|country bird|கோழி|சிக்கன்/i

/** Eggs win over chicken ("நாட்டுக் கோழி முட்டை" is eggs); falls back to the category name. */
export function artKind(...texts: (string | null | undefined)[]): ArtKind {
  for (const t of texts) {
    if (!t) continue
    if (EGG.test(t)) return "egg"
    if (CHICKEN.test(t)) return "chicken"
  }
  return "basket"
}

export const MAX_PHOTO_BYTES = 400 * 1024

/** JPEG, PNG or WebP by their first bytes; anything else is refused. */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp"
  return null
}
