import { describe, expect, it } from "vitest"
import { openingParts, openingScript } from "./opening"

describe("opening", () => {
  it("writes a script that runs", () => {
    for (const app of ["shop", "farm", "admin"] as const) expect(() => new Function(openingScript(app, openingParts(app, { hasMark: true })))).not.toThrow()
  })

  it("plays FarmForYou's part, then the farm's, for the shop and the farm app; FarmForYou's alone for admin", () => {
    expect(openingParts("shop", { hasMark: true })).toHaveLength(2)
    expect(openingParts("farm", { hasMark: false })).toHaveLength(2)
    expect(openingParts("admin", { hasMark: true })).toHaveLength(1)
    expect(openingParts("shop", null)).toHaveLength(1)
  })

  it("lasts the same for every farm, with a mark or a logo", () => {
    const length = (hasMark: boolean) => openingParts("shop", { hasMark }).reduce((s, p) => s + p.end, 0)
    expect(length(true)).toBe(length(false))
    for (const p of [...openingParts("shop", { hasMark: true }), ...openingParts("shop", { hasMark: false })]) expect(p.drawn).toBeLessThan(p.end)
  })
})
