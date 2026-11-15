import { describe, expect, it } from "vitest"
import { cleanDetailValues, detailKey, detailLine, mergeDetails, mergePacks, readDetails, STARTER_KINDS, type DetailDef } from "./product-kinds"
import { isPicture } from "@/components/art/drawing-library"

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
    expect(mergeDetails(milk.details, [own, milk.details[0]]).map((d) => d.key)).toEqual(["animal", "a2", "breed", "fat"])
    const extra = { ...own, key: "teat" }
    expect(mergeDetails(milk.details, [extra]).map((d) => d.key)).toEqual(["animal", "a2", "breed", "fat", "teat"])
    expect(mergePacks(milk.packs, [{ ta: "1 லி", en: "1 LITRE" }, { ta: "கேன்", en: "5 litre can" }]).map((p) => p.en)).toEqual(["1 litre", "½ litre", "5 litre can"])
  })

  it("makes a key from a detail's English name, unique among those taken", () => {
    expect(detailKey("Fat %", [])).toBe("fat")
    expect(detailKey("Fat %", ["fat"])).toBe("fat_2")
    expect(detailKey("2 layers", [])).toBe("d2_layers")
    expect(detailKey("!!!", [])).toBe("detail")
  })
})

/**
 * Everything South Indian farms sell, by module: each must be a starter kind, or a choice in one (so a farm finds it
 * when it makes a category or a product). Add to this list when a new product comes up.
 */
const COVERAGE: Record<string, string[]> = {
  poultry: ["Eggs", "Country hen", "Duck", "Quail", "Turkey", "Hatching eggs", "Country chicken", "Rooster", "Kadaknath", "Broiler", "Guinea fowl", "Chicks", "Dressed chicken", "Poultry manure"],
  livestock: [
    "Milk", "Cow", "Buffalo", "Goat", "A2", "Curd", "Buttermilk", "Butter", "Ghee", "Paneer", "Khoa", "Palkova", "Sheep", "Kanni", "Kodi", "Tellicherry", "Mecheri",
    "Cattle", "Calf", "Bull", "Kangayam", "Umblachery", "Murrah", "Pigs", "Rabbits", "Mutton", "Pork", "Dung cakes", "Farmyard manure", "Compost", "Vermicompost",
    "Panchagavya", "Jeevamirtham", "Fodder", "Silage", "Paddy straw", "Cattle feed",
  ],
  fishery: ["Fresh fish", "Rohu", "Catla", "Mrigal", "Tilapia", "Murrel", "Pearl spot", "Prawns", "Vannamei", "Crabs", "Mud crab", "Dried fish", "Anchovy", "Fingerlings"],
  crops: [
    "Paddy", "Rice", "Ponni", "Seeraga samba", "Mappillai samba", "Karuppu kavuni", "Millets", "Ragi", "Kambu", "Cholam", "Thinai", "Samai", "Varagu", "Kuthiraivali",
    "Pulses", "Toor", "Urad", "Moong", "Horse gram", "Maize", "Groundnut", "Sesame", "Sunflower", "Vegetables", "Greens", "Moringa leaves", "Curry leaf", "Mint",
    "Coriander", "Tulsi", "Fruits", "Mango", "Guava", "Papaya", "Jackfruit", "Sapota", "Amla", "Bananas", "Poovan", "Nendran", "Red banana", "Banana leaf",
    "Coconut", "Tender coconut", "Copra", "Sugarcane", "Jaggery", "Palm jaggery", "Turmeric", "Spices", "Pepper", "Cardamom", "Tamarind", "Flowers", "Jasmine",
    "Kanakambaram", "Marigold", "Rose", "Tuberose", "Garlands", "Arecanut", "Coffee", "Tea", "Cashew", "Cotton", "Silk cocoons", "Mushrooms", "Seeds",
    "Seedlings", "Coconut seedling", "Firewood",
  ],
  selling: [
    "Cold-pressed oils", "Gingelly", "Coconut", "Honey", "Wild honey", "Pickles", "Mango", "Podi", "Sambar powder", "Flours", "Health mix", "Idli/dosa batter",
    "Snacks", "Murukku", "Athirasam", "Kadalai mittai", "Appalam", "Vadagam", "Shikakai", "Soapnut", "Tractor", "Ploughing", "Farm visits",
  ],
}

describe("the starter list covers what farms sell", () => {
  it("gives every kind a drawing that exists", () => {
    for (const k of STARTER_KINDS) expect(isPicture(k.art), `${k.key}: ${k.art}`).toBe(true)
  })

  it("has kinds for every module that sells, and every product on the coverage list", () => {
    const words = (m: string) =>
      STARTER_KINDS.filter((k) => k.module === m)
        .flatMap((k) => [k.nameEn, ...k.details.flatMap((d) => d.choices.map((c) => c.en)), ...k.details.map((d) => d.en)])
        .map((x) => x.toLowerCase())
    const missing: string[] = []
    for (const [m, list] of Object.entries(COVERAGE)) {
      expect(STARTER_KINDS.some((k) => k.module === m), m).toBe(true)
      for (const item of list) if (!words(m).some((x) => x.includes(item.toLowerCase()))) missing.push(`${m}: ${item}`)
    }
    expect(missing).toEqual([])
  })

  it("names every kind, size and choice in Tamil too", () => {
    for (const k of STARTER_KINDS) {
      expect(k.nameTa.trim(), k.key).not.toBe("")
      for (const p of k.packs) expect(p.ta.trim(), `${k.key} ${p.en}`).not.toBe("")
      for (const d of k.details) for (const c of d.choices) expect(c.ta.trim(), `${k.key} ${c.en}`).not.toBe("")
    }
  })
})
