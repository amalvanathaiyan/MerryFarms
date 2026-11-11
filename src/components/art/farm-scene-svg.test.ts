import { describe, expect, it } from "vitest"
import { cartSceneSvg, farmSceneSvg, type SceneWords } from "./farm-scene-svg"

const words: SceneWords = { name: "Merry Farms", shop: "FARM SHOP", eggs: "Country eggs", chicken: "Country chicken", fresh: "Fresh today" }
const KINDS = ["gate", "stall", "hen"] as const
const PHASES = ["dawn", "day", "evening", "night"] as const

describe("the farm's live pictures", () => {
  it("draws every scene in every light", () => {
    for (const k of KINDS) for (const p of PHASES) {
      const svg = farmSceneSvg(k, p, words)
      expect(svg.startsWith("<svg") && svg.endsWith("</svg>")).toBe(true)
      expect(svg).toContain('aria-hidden="true"')
    }
  })

  it("puts the farm's name on the gate, first word red and the rest green", () => {
    const svg = farmSceneSvg("gate", "day", words)
    expect(svg).toMatch(/>Merry <tspan fill="#2F7A3A">Farms<\/tspan><\/text>/)
    expect(farmSceneSvg("gate", "day", { ...words, name: "மெர்ரி ஃபார்ம்ஸ்" })).toContain("மெர்ரி <tspan")
  })

  it("never lets a farm's name or label break the drawing", () => {
    const svg = farmSceneSvg("gate", "day", { ...words, name: `Ravi's <Farm> & "Sons"` })
    expect(svg).toContain("Ravi's <tspan fill=\"#2F7A3A\">&lt;Farm&gt; &amp; &quot;Sons&quot;</tspan>")
    expect(svg).not.toContain("<Farm>")
  })

  it("fits a long name on the sign: smaller, then squeezed to the board", () => {
    expect(farmSceneSvg("gate", "day", words)).not.toContain("textLength")
    const long = farmSceneSvg("gate", "day", { ...words, name: "Sri Venkateswara Organic Country Farms" })
    expect(long).toContain('textLength="156"')
  })

  it("hens peck and chicks hop by day; at night they sleep under the moon, stars and lit lamps", () => {
    const day = farmSceneSvg("gate", "day", words)
    expect(day).toContain("fs-head")
    expect(day).toContain("fs-hop")
    expect(day).not.toContain("fs-twinkle")
    const night = farmSceneSvg("gate", "night", words)
    expect(night).not.toContain("fs-head")
    expect(night).not.toContain("fs-hop")
    expect(night).toContain("fs-breathe")
    expect(night).toContain("fs-twinkle")
    expect(night).toContain("fs-firefly")
    expect(night).toContain("fs-flicker")
    expect(farmSceneSvg("stall", "evening", words)).toContain("fs-flicker")
    expect(farmSceneSvg("stall", "day", words)).not.toContain("fs-flicker")
  })

  it("draws the bullock cart in every light, on the road or on its own, with every tag closed", () => {
    for (const p of PHASES) for (const plain of [false, true]) {
      const svg = cartSceneSvg(p, plain)
      expect(svg.startsWith("<svg") && svg.endsWith("</svg>")).toBe(true)
      expect((svg.match(/<g[\s>]/g) ?? []).length).toBe((svg.match(/<\/g>/g) ?? []).length)
      expect(svg).toContain("fs-wheel")
      expect(svg).toContain("fs-step")
      expect(svg.includes(`id="fs-cart-${p}-sky"`)).toBe(!plain)
    }
    expect(cartSceneSvg("night")).toContain("fs-twinkle")
    expect(cartSceneSvg("day")).not.toContain("fs-twinkle")
  })

  it("keeps an id per scene and light, so two different skies on one page never share a gradient", () => {
    expect(farmSceneSvg("gate", "day", words)).toContain('id="fs-gate-day-sky"')
    expect(farmSceneSvg("stall", "night", words)).toContain("url(#fs-stall-night-sky)")
  })
})
