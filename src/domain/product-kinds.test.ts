import { describe, expect, it } from "vitest"
import { cleanDetailValues, detailKey, detailLine, mergeDetails, mergePacks, readDetails, STARTER_KINDS, type DetailDef } from "./product-kinds"

const milk = STARTER_KINDS.find((k) => k.key === "milk")!
const yesNo = { yes: "Yes", no: "No" }

describe("product kinds", () => {
  it("has a valid starter list: unique keys, every detail readable back", () => {
    expect(new Set(STARTER_KINDS.map((k) => k.key)).size).toBe(STARTER_KINDS.length)
    for (const k of STARTER_KINDS) {
      expect(readDetails(k.details)).toHaveLength(k.details.length)
      expect(new Set(k.details.map((d) => d.key)).size).toBe(k.details.length)
    }
  })

  it("keeps only answers of the right type, and says which required ones are missing", () => {
    const { values, missing } = cleanDetailValues(milk.details, { animal: "Cow", a2: true, fat: 4.5, extra: "x" })
    expect(values).toEqual({ animal: "Cow", a2: true, fat: 4.5 })
    expect(missing).toEqual([])
    expect(cleanDetailValues(milk.details, { animal: "Camel", fat: "lots" })).toEqual({ values: {}, missing: ["animal"] })
  })

  it("writes the shown details for the shop in the customer's language", () => {
    const values = { animal: "Buffalo", a2: true, fat: 6 }
    expect(detailLine(milk.details, values, "en", yesNo)).toBe("Buffalo · A2 · Fat %: 6")
    expect(detailLine(milk.details, values, "ta", yesNo)).toBe("எருமை · A2 · கொழுப்பு %: 6")
    const hidden: DetailDef[] = [{ ...milk.details[2], shown: false }]
    expect(detailLine(hidden, values, "en", yesNo)).toBe("")
  })

  it("adds a farm's own details and sizes after the kind's, without repeats", () => {
    const own: DetailDef = { key: "breed", ta: "இனம்", en: "Breed", type: "text", choices: [], required: false, shown: true }
    expect(mergeDetails(milk.details, [own, milk.details[0]]).map((d) => d.key)).toEqual(["animal", "a2", "fat", "breed"])
    expect(mergePacks(milk.packs, [{ ta: "1 லி", en: "1 LITRE" }, { ta: "கேன்", en: "5 litre can" }]).map((p) => p.en)).toEqual(["1 litre", "½ litre", "5 litre can"])
  })

  it("makes a key from a detail's English name, unique among those taken", () => {
    expect(detailKey("Fat %", [])).toBe("fat")
    expect(detailKey("Fat %", ["fat"])).toBe("fat_2")
    expect(detailKey("2 layers", [])).toBe("d2_layers")
    expect(detailKey("!!!", [])).toBe("detail")
  })
})
