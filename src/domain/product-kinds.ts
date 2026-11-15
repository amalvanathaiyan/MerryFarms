/**
 * Product kinds (docs/platform-plan.md §3.3): set by Farm For You admin, not in code. Each kind says how it's
 * measured, the pack sizes usual for it, the details asked for each product (egg type; milk animal, A2, fat %) and
 * defaults (GST, HSN, shelf life). A farm's category is one of these kinds, or its own; either way the farm can add
 * its own pack sizes and details on top. Pure, so it is tested; the starter list below is what admin can load in one
 * tap and then change.
 */
import { z } from "zod"
import type { ArtKind } from "./product-art"
import type { ModuleKey } from "./modules"

export const MEASURES = ["count", "weight", "volume"] as const
export type Measure = (typeof MEASURES)[number]
export const DETAIL_TYPES = ["choice", "number", "text", "yesno"] as const
export type DetailType = (typeof DETAIL_TYPES)[number]

const words = z.object({ ta: z.string().trim().min(1).max(40), en: z.string().trim().min(1).max(40) })
export type Words = z.infer<typeof words>

export const packSchema = words
export type PackDef = Words

export const detailSchema = z.object({
  /** Stays the same when the names change, so products keep their answers. */
  key: z.string().regex(/^[a-z][a-z0-9_]{0,29}$/),
  ta: z.string().trim().min(1).max(40),
  en: z.string().trim().min(1).max(40),
  type: z.enum(DETAIL_TYPES),
  choices: z.array(words).max(20).default([]),
  required: z.boolean().default(false),
  /** Shown to customers on the product (otherwise only the farm sees it). */
  shown: z.boolean().default(true),
})
export type DetailDef = z.infer<typeof detailSchema>

export const packsSchema = z.array(packSchema).max(20)
export const detailsSchema = z.array(detailSchema).max(15)

/** Reads stored packs or details defensively: anything malformed is left out, never thrown. */
export function readPacks(raw: unknown): PackDef[] {
  const r = packsSchema.safeParse(raw)
  return r.success ? r.data : []
}
export function readDetails(raw: unknown): DetailDef[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((d) => {
    const r = detailSchema.safeParse(d)
    return r.success ? [r.data] : []
  })
}

/** A key for a detail from its English name ("Fat %" → "fat"); unique among the keys already used. */
export function detailKey(en: string, taken: string[]): string {
  const base = (en.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "d$1") || "detail").slice(0, 24)
  let k = base
  for (let i = 2; taken.includes(k); i++) k = `${base}_${i}`
  return k
}

/** The kind's details and the category's own, the category's after (a key the kind already has is the kind's). */
export function mergeDetails(kind: DetailDef[], own: DetailDef[]): DetailDef[] {
  return [...kind, ...own.filter((d) => !kind.some((k) => k.key === d.key))]
}
export function mergePacks(kind: PackDef[], own: PackDef[]): PackDef[] {
  return [...kind, ...own.filter((p) => !kind.some((k) => k.en.toLowerCase() === p.en.toLowerCase()))]
}

export type DetailValue = string | number | boolean
export type DetailValues = Record<string, DetailValue>

/**
 * A product's answers checked against the details asked: kept only for known details, of the right type (a choice
 * must be one of its choices, by English name). Returns the missing required ones too.
 */
export function cleanDetailValues(defs: DetailDef[], raw: unknown): { values: DetailValues; missing: string[] } {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const values: DetailValues = {}
  const missing: string[] = []
  for (const d of defs) {
    const v = input[d.key]
    let ok: DetailValue | undefined
    if (d.type === "yesno" && typeof v === "boolean") ok = v
    if (d.type === "number" && typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e7) ok = v
    if (d.type === "text" && typeof v === "string" && v.trim()) ok = v.trim().slice(0, 80)
    if (d.type === "choice" && typeof v === "string" && d.choices.some((c) => c.en === v)) ok = v
    if (ok === undefined) {
      if (d.required) missing.push(d.key)
    } else values[d.key] = ok
  }
  return { values, missing }
}

/** "Country · Large · A2" for the shop: the shown details with an answer, in the customer's language. */
export function detailLine(defs: DetailDef[], values: DetailValues, lang: "ta" | "en", yesNo: { yes: string; no: string }): string {
  const parts: string[] = []
  for (const d of defs) {
    if (!d.shown || values[d.key] === undefined) continue
    const v = values[d.key]
    const name = lang === "ta" ? d.ta : d.en
    if (d.type === "choice") {
      const c = d.choices.find((x) => x.en === v)
      if (c) parts.push(lang === "ta" ? c.ta : c.en)
    } else if (d.type === "yesno") {
      if (v === true) parts.push(name)
      else parts.push(`${name}: ${yesNo.no}`)
    } else parts.push(`${name}: ${v}`)
  }
  return parts.join(" · ")
}

// ── The starter list ─────────────────────────────────────────────────────────────────────────────────────────

export interface KindDef {
  key: string
  module: ModuleKey
  nameTa: string
  nameEn: string
  art: ArtKind
  measure: Measure
  packs: PackDef[]
  details: DetailDef[]
  weighedOnDelivery: boolean
  shelfLifeDays: number | null
  hsn: string | null
  gstRate: 0 | 5 | 12 | 18
}

const w = (ta: string, en: string): Words => ({ ta, en })
const choice = (key: string, ta: string, en: string, choices: Words[], required = false): DetailDef => ({ key, ta, en, type: "choice", choices, required, shown: true })
const yesno = (key: string, ta: string, en: string): DetailDef => ({ key, ta, en, type: "yesno", choices: [], required: false, shown: true })
const numberOf = (key: string, ta: string, en: string): DetailDef => ({ key, ta, en, type: "number", choices: [], required: false, shown: true })
const kind = (k: Omit<KindDef, "weighedOnDelivery" | "shelfLifeDays" | "hsn" | "gstRate"> & Partial<KindDef>): KindDef => ({
  weighedOnDelivery: false,
  shelfLifeDays: null,
  hsn: null,
  gstRate: 0,
  ...k,
})

const KG = [w("1 கிலோ", "1 kg"), w("½ கிலோ", "½ kg"), w("¼ கிலோ", "¼ kg")]
const LITRE = [w("1 லிட்டர்", "1 litre"), w("½ லிட்டர்", "½ litre")]
const BOTTLE = [w("1 லிட்டர் பாட்டில்", "1 litre bottle"), w("½ லிட்டர் பாட்டில்", "½ litre bottle"), w("200 மி.லி. பாட்டில்", "200 ml bottle")]

export const STARTER_KINDS: KindDef[] = [
  // Poultry
  kind({
    key: "eggs", module: "poultry", nameTa: "முட்டை", nameEn: "Eggs", art: "egg", measure: "count", hsn: "0407", shelfLifeDays: 21,
    packs: [w("6 முட்டை", "6 eggs"), w("12 முட்டை", "12 eggs"), w("30 முட்டை (தட்டு)", "Tray of 30")],
    details: [choice("egg_type", "முட்டை வகை", "Egg type", [w("நாட்டுக் கோழி", "Country hen"), w("லேயர்", "Layer"), w("வாத்து", "Duck"), w("காடை", "Quail")], true), choice("size", "அளவு", "Size", [w("சிறியது", "Small"), w("நடுத்தரம்", "Medium"), w("பெரியது", "Large")])],
  }),
  kind({
    key: "live_birds", module: "poultry", nameTa: "உயிருள்ள கோழி", nameEn: "Live birds", art: "chicken", measure: "count",
    packs: [w("1 கோழி", "1 bird")],
    details: [choice("bird", "பறவை", "Bird", [w("நாட்டுக் கோழி", "Country chicken"), w("சேவல்", "Rooster"), w("வாத்து", "Duck"), w("காடை", "Quail"), w("வான்கோழி", "Turkey")], true), numberOf("weight_kg", "சுமார் எடை (கிலோ)", "About (kg)")],
  }),
  kind({
    key: "dressed_chicken", module: "poultry", nameTa: "சுத்தம் செய்த கோழி", nameEn: "Dressed chicken", art: "chicken", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 2, hsn: "0207",
    packs: KG,
    details: [choice("cut", "வெட்டு", "Cut", [w("முழுசு", "Whole"), w("கறிக்கு", "Curry cut"), w("எலும்பில்லாதது", "Boneless")]), yesno("with_skin", "தோலுடன்", "With skin")],
  }),
  // Livestock
  kind({
    key: "milk", module: "livestock", nameTa: "பால்", nameEn: "Milk", art: "milk", measure: "volume", shelfLifeDays: 1, hsn: "0401",
    packs: LITRE,
    details: [choice("animal", "விலங்கு", "Animal", [w("பசு", "Cow"), w("எருமை", "Buffalo"), w("ஆடு", "Goat")], true), yesno("a2", "A2", "A2"), numberOf("fat", "கொழுப்பு %", "Fat %")],
  }),
  kind({ key: "curd", module: "livestock", nameTa: "தயிர்", nameEn: "Curd", art: "dairy", measure: "weight", shelfLifeDays: 3, hsn: "0403", packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [] }),
  kind({ key: "ghee", module: "livestock", nameTa: "நெய்", nameEn: "Ghee", art: "dairy", measure: "volume", shelfLifeDays: 180, hsn: "0405", gstRate: 12, packs: [w("½ கிலோ", "½ kg"), w("200 கிராம்", "200 g"), w("1 கிலோ", "1 kg")], details: [choice("animal", "விலங்கு", "Animal", [w("பசு", "Cow"), w("எருமை", "Buffalo")]), yesno("bilona", "கடைந்த நெய்", "Bilona (hand-churned)")] }),
  kind({ key: "paneer_butter", module: "livestock", nameTa: "பனீர் & வெண்ணெய்", nameEn: "Paneer & butter", art: "dairy", measure: "weight", shelfLifeDays: 5, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg")], details: [] }),
  kind({ key: "mutton", module: "livestock", nameTa: "ஆட்டுக் கறி", nameEn: "Mutton", art: "chicken", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 2, packs: KG, details: [choice("cut", "வெட்டு", "Cut", [w("கறிக்கு", "Curry cut"), w("எலும்பில்லாதது", "Boneless"), w("கொத்துக்கறி", "Mince")])] }),
  kind({ key: "manure", module: "livestock", nameTa: "எரு & உரம்", nameEn: "Manure & compost", art: "plants", measure: "weight", packs: [w("25 கிலோ மூட்டை", "25 kg bag"), w("50 கிலோ மூட்டை", "50 kg bag")], details: [] }),
  // Fishery
  kind({
    key: "fish", module: "fishery", nameTa: "மீன்", nameEn: "Fish", art: "chicken", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 1, hsn: "0302",
    packs: KG,
    details: [choice("species", "மீன் வகை", "Fish", [w("ரோகு", "Rohu"), w("கட்லா", "Catla"), w("விரால்", "Murrel"), w("திலாப்பியா", "Tilapia"), w("இறால்", "Prawns")], true), choice("state", "நிலை", "As", [w("உயிருடன்", "Live"), w("புதியது", "Fresh"), w("சுத்தம் செய்தது", "Cleaned")]), choice("cut", "வெட்டு", "Cut", [w("முழுசு", "Whole"), w("துண்டுகள்", "Slices")])],
  }),
  kind({ key: "dried_fish", module: "fishery", nameTa: "கருவாடு", nameEn: "Dried fish", art: "chicken", measure: "weight", shelfLifeDays: 90, packs: [w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg")], details: [] }),
  // Crops
  kind({ key: "rice", module: "crops", nameTa: "அரிசி", nameEn: "Rice", art: "grains", measure: "weight", shelfLifeDays: 180, hsn: "1006", packs: [w("1 கிலோ", "1 kg"), w("5 கிலோ", "5 kg"), w("25 கிலோ மூட்டை", "25 kg bag")], details: [choice("variety", "ரகம்", "Variety", [w("சீரக சம்பா", "Seeraga samba"), w("மாப்பிள்ளை சம்பா", "Mappillai samba"), w("பொன்னி", "Ponni"), w("கருப்புக் கவுனி", "Karuppu kavuni")]), choice("type", "வகை", "Type", [w("பச்சரிசி", "Raw"), w("புழுங்கல்", "Boiled")]), yesno("hand_pounded", "கைக்குத்தல்", "Hand-pounded")] }),
  kind({ key: "millets", module: "crops", nameTa: "சிறுதானியங்கள்", nameEn: "Millets", art: "grains", measure: "weight", shelfLifeDays: 180, packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("millet", "தானியம்", "Millet", [w("கேழ்வரகு", "Ragi"), w("கம்பு", "Kambu"), w("தினை", "Thinai"), w("சாமை", "Samai"), w("வரகு", "Varagu")], true)] }),
  kind({ key: "vegetables", module: "crops", nameTa: "காய்கறிகள்", nameEn: "Vegetables", art: "vegetables", measure: "weight", shelfLifeDays: 4, packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg"), w("¼ கிலோ", "¼ kg")], details: [yesno("organic", "இயற்கை முறை", "Natural farming")] }),
  kind({ key: "greens", module: "crops", nameTa: "கீரைகள்", nameEn: "Greens", art: "greens", measure: "count", shelfLifeDays: 2, packs: [w("1 கட்டு", "1 bunch")], details: [choice("keerai", "கீரை", "Greens", [w("அரைக்கீரை", "Arai keerai"), w("சிறுகீரை", "Siru keerai"), w("முளைக்கீரை", "Mulai keerai"), w("அகத்திக்கீரை", "Agathi keerai")])] }),
  kind({ key: "fruits", module: "crops", nameTa: "பழங்கள்", nameEn: "Fruits", art: "fruits", measure: "weight", shelfLifeDays: 5, packs: [w("1 கிலோ", "1 kg"), w("1 சீப்பு", "1 hand (bananas)"), w("1 டஜன்", "1 dozen")], details: [] }),
  kind({ key: "coconut", module: "crops", nameTa: "தேங்காய் & இளநீர்", nameEn: "Coconut & tender coconut", art: "fruits", measure: "count", packs: [w("1 காய்", "1 nut"), w("10 காய்", "10 nuts")], details: [choice("type", "வகை", "Type", [w("தேங்காய்", "Coconut"), w("இளநீர்", "Tender coconut")])] }),
  kind({ key: "spices", module: "crops", nameTa: "மஞ்சள் & மசாலா", nameEn: "Turmeric & spices", art: "spices", measure: "weight", shelfLifeDays: 365, gstRate: 5, packs: [w("100 கிராம்", "100 g"), w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg")], details: [] }),
  kind({ key: "flowers", module: "crops", nameTa: "பூக்கள்", nameEn: "Flowers", art: "plants", measure: "count", shelfLifeDays: 1, packs: [w("1 முழம்", "1 muzham"), w("100 கிராம்", "100 g")], details: [] }),
  kind({ key: "seedlings", module: "crops", nameTa: "நாற்றுகள் & விதைகள்", nameEn: "Seedlings & seeds", art: "plants", measure: "count", packs: [w("1 கன்று", "1 plant"), w("1 பாக்கெட்", "1 packet")], details: [] }),
  // Value-added (sold under Selling)
  kind({ key: "oils", module: "selling", nameTa: "செக்கு எண்ணெய்", nameEn: "Cold-pressed oils", art: "oil", measure: "volume", shelfLifeDays: 180, gstRate: 5, packs: BOTTLE, details: [choice("oil", "எண்ணெய்", "Oil", [w("நல்லெண்ணெய்", "Gingelly"), w("கடலை எண்ணெய்", "Groundnut"), w("தேங்காய் எண்ணெய்", "Coconut")], true), yesno("wood_pressed", "மரச்செக்கு", "Wood-pressed")] }),
  kind({ key: "honey", module: "selling", nameTa: "தேன்", nameEn: "Honey", art: "honey", measure: "weight", shelfLifeDays: 365, packs: [w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [] }),
  kind({ key: "pickles", module: "selling", nameTa: "ஊறுகாய் & பொடி", nameEn: "Pickles & podi", art: "pickles", measure: "weight", shelfLifeDays: 180, gstRate: 12, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg")], details: [] }),
  kind({ key: "flours", module: "selling", nameTa: "மாவு", nameEn: "Flours & maavu", art: "grains", measure: "weight", shelfLifeDays: 60, packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [] }),
]

