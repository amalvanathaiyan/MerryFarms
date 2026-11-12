/**
 * The app's colours from a brand: Farm For You's for the platform's own screens, a farm's own in its shop and farm
 * app. From one action colour and one accent colour it makes every variant the app has (light, dark, soft light,
 * soft dark), each adjusted until it is readable: action colours carry white text (light) or dark text (dark) at
 * 4.5:1 or better, the standard for normal text. Pure, so it is tested.
 */

export type Rgb = [number, number, number]

/** Farm For You's own colours (locked 2026-11-12). The action colour is the deep leaf green: the brand's #1E8A4C
 *  stays for the mark and fills, as white text on it is just under 4.5:1. */
export const FFY_THEME = { primary: "#17703D", accent: "#F5B301" } as const

const HEX = /^#?([0-9a-f]{6})$/i
export function hexToRgb(hex: string): Rgb | null {
  const m = HEX.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()

function luminance([r, g, b]: Rgb) {
  const c = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
}
export function contrast(a: Rgb, b: Rgb) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Moves the colour towards `toward` in small steps until it reaches `ratio` against every colour in `against`. */
export function readable(colour: Rgb, against: Rgb[], toward: Rgb, ratio = 4.6): Rgb {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(colour, toward, t)
    if (against.every((x) => contrast(c, x) >= ratio)) return c.map(Math.round) as Rgb
  }
  return toward
}

function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h * 60, s * 100, l * 100]
}
function fromHsl(h: number, s: number, l: number): Rgb {
  const S = s / 100, L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
/** "H S% L%", the form the app's colour tokens take (used as hsl(var(--primary))). */
export const hslTriple = (c: Rgb) => {
  const [h, s, l] = toHsl(c)
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`
}
const soften = (c: Rgb, amount = 0.35): Rgb => {
  const [h, s, l] = toHsl(c)
  return fromHsl(h, s * (1 - amount), l)
}

const WHITE: Rgb = [255, 255, 255], BLACK: Rgb = [0, 0, 0]
/** The surfaces of each variant (matching globals.css): what action colours and links must read against. */
const SURFACE = {
  light: [[255, 255, 255], [244, 246, 238]] as Rgb[], // card, field ground
  dark: [[25, 31, 28], [18, 23, 20]] as Rgb[],
  softLight: [[247, 247, 242], [237, 237, 228]] as Rgb[],
  softDark: [[41, 46, 43], [34, 38, 36]] as Rgb[],
}
const DARK_TEXT: Rgb = [14, 26, 19]

/** A highlight colour and its text: white if it reads, else dark text if that reads (a light colour such as turmeric
 *  stays itself), else darkened until white reads. */
function highlight(a: Rgb): { bg: Rgb; fg: Rgb } {
  if (contrast(a, WHITE) >= 4.5) return { bg: a, fg: WHITE }
  if (contrast(a, DARK_TEXT) >= 4.5) return { bg: a, fg: DARK_TEXT }
  return { bg: readable(a, [WHITE], BLACK), fg: WHITE }
}

export type ThemeVariant = { primary: string; primaryForeground: string; ring: string; accentTint: string; brandAccent: string; brandAccentForeground: string; chart: string }

/** Every variant's colours for one brand. Returns null for colours that aren't #rrggbb. */
export function brandTheme(primaryHex: string, accentHex: string): Record<keyof typeof SURFACE, ThemeVariant> | null {
  const p = hexToRgb(primaryHex), a = hexToRgb(accentHex)
  if (!p || !a) return null
  const light = (base: Rgb, surfaces: Rgb[]): ThemeVariant => {
    // White text on the action colour and the colour as text on the page: darken until both read.
    const primary = readable(base, [WHITE, ...surfaces], BLACK)
    const accent = highlight(a)
    return {
      primary: hslTriple(primary),
      primaryForeground: "0 0% 100%",
      ring: hslTriple(primary),
      accentTint: hslTriple(mix(primary, surfaces[0], 0.86)),
      brandAccent: hslTriple(accent.bg),
      brandAccentForeground: hslTriple(accent.fg),
      chart: rgbToHex(primary),
    }
  }
  const dark = (base: Rgb, surfaces: Rgb[]): ThemeVariant => {
    // Dark text on the action colour and the colour as text on the dark page: lighten until both read.
    const primary = readable(base, [DARK_TEXT, ...surfaces], WHITE)
    const accent = highlight(a)
    return {
      primary: hslTriple(primary),
      primaryForeground: hslTriple(DARK_TEXT),
      ring: hslTriple(primary),
      accentTint: hslTriple(mix(primary, surfaces[0], 0.8)),
      brandAccent: hslTriple(accent.bg),
      brandAccentForeground: hslTriple(accent.fg),
      chart: rgbToHex(primary),
    }
  }
  return {
    light: light(p, SURFACE.light),
    dark: dark(p, SURFACE.dark),
    softLight: light(soften(p), SURFACE.softLight),
    softDark: dark(soften(p), SURFACE.softDark),
  }
}

const block = (v: ThemeVariant) =>
  `--primary:${v.primary};--primary-foreground:${v.primaryForeground};--ring:${v.ring};--accent:${v.accentTint};--brand-accent:${v.brandAccent};--brand-accent-foreground:${v.brandAccentForeground};--chart-1:${v.chart};`

/**
 * CSS for one brand, in the same variants and selectors as globals.css. `scope` limits it to part of the page
 * (".ffy-chrome" for the platform's own screens inside a farm's address); empty = the whole page.
 */
export function brandThemeCss(primaryHex: string, accentHex: string, scope = ""): string {
  const t = brandTheme(primaryHex, accentHex)
  if (!t) return ""
  const s = scope ? ` ${scope}` : ""
  // "html:root" is a touch more specific than globals.css's ":root", so these win whichever stylesheet loads first.
  const r = "html:root"
  return [
    `${r}${s}{${block(t.light)}}`,
    `@media (prefers-color-scheme: dark){${r}:not([data-theme="light"])${s}{${block(t.dark)}}}`,
    `${r}[data-theme="dark"]${s}{${block(t.dark)}}`,
    `${r}[data-soft="on"]${s}{${block(t.softLight)}}`,
    `@media (prefers-color-scheme: dark){${r}[data-soft="on"]:not([data-theme="light"])${s}{${block(t.softDark)}}}`,
    `${r}[data-soft="on"][data-theme="dark"]${s}{${block(t.softDark)}}`,
  ].join("")
}
