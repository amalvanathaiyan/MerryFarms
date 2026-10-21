import { describe, expect, it } from "vitest"
import ta from "../../messages/ta.json"
import en from "../../messages/en.json"

/** Every key path in a nested messages object, e.g. "farm.nav.today". */
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

describe("translations", () => {
  it("has every English text in Tamil too, and nothing extra", () => {
    expect(keys(ta).sort()).toEqual(keys(en).sort())
  })

  it("has no empty Tamil text", () => {
    const empty = keys(ta).filter((k) => {
      const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], ta)
      return typeof v !== "string" || v.trim() === ""
    })
    expect(empty).toEqual([])
  })
})
