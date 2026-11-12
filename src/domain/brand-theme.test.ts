import { describe, expect, it } from "vitest"
import { brandTheme, brandThemeCss, contrast, FFY_THEME, hexToRgb, type Rgb } from "./brand-theme"

const hsl = (triple: string): Rgb => {
  const [h, s, l] = triple.replace(/%/g, "").split(" ").map(Number)
  const S = s / 100, L = l / 100, k = (n: number) => (n + h / 30) % 12, a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

describe("brandTheme", () => {
  it("keeps every action colour readable in every variant (rounding allows a hair under 4.6)", () => {
    for (const [p, a] of [[FFY_THEME.primary, FFY_THEME.accent], ["#1F6B3A", "#A8262B"], ["#F5B301", "#FFFFFF"], ["#7A4A12", "#1E8A4C"]]) {
      const t = brandTheme(p, a)!
      for (const v of [t.light, t.softLight]) expect(contrast(hsl(v.primary), [255, 255, 255])).toBeGreaterThanOrEqual(4.4)
      for (const v of [t.dark, t.softDark]) expect(contrast(hsl(v.primary), [14, 26, 19])).toBeGreaterThanOrEqual(4.4)
      for (const v of [t.light, t.dark]) expect(contrast(hsl(v.brandAccent), hsl(v.brandAccentForeground))).toBeGreaterThanOrEqual(4.4)
    }
  })

  it("leaves an already readable colour as it is", () => {
    // Merry Farms' green carries white text at 6.5:1, so it stays itself in the light theme
    expect(brandTheme("#1F6B3A", "#A8262B")!.light.chart).toBe("#1F6B3A")
  })

  it("darkens a colour too light for white text (turmeric yellow)", () => {
    const t = brandTheme("#F5B301", "#A8262B")!
    expect(contrast(hexToRgb(t.light.chart)!, [255, 255, 255])).toBeGreaterThanOrEqual(4.5)
  })

  it("keeps a light highlight such as turmeric itself, with dark text", () => {
    const t = brandTheme(FFY_THEME.primary, FFY_THEME.accent)!
    expect(t.light.brandAccent).toBe("44 99% 48%") // turmeric #F5B301 itself
    expect(t.light.brandAccentForeground).not.toBe("0 0% 100%")
  })

  it("refuses colours that aren't #rrggbb", () => {
    expect(brandTheme("green", "#A8262B")).toBeNull()
    expect(brandThemeCss("#123", "#A8262B")).toBe("")
  })

  it("writes every variant, scoped when asked", () => {
    const css = brandThemeCss("#1F6B3A", "#A8262B", ".ffy-chrome")
    expect(css).toContain("html:root .ffy-chrome{--primary:")
    expect(css).toContain('html:root[data-soft="on"][data-theme="dark"] .ffy-chrome{')
    expect(css.match(/--primary:/g)).toHaveLength(6)
  })
})
