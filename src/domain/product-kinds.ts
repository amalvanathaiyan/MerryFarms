/**
 * Product kinds (docs/platform-plan.md §3.3): set by Farm For You admin, not in code. Each kind says how it's
 * measured, the pack sizes usual for it, the details asked for each product (egg type; milk animal, A2, fat %) and
 * defaults (GST, HSN, shelf life). A farm's category is one of these kinds, or its own; either way the farm can add
 * its own pack sizes and details on top. Pure, so it is tested; the starter list below is what admin can load in one
 * tap and then change.
 */
import { z } from "zod"
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
  /** One of the 14 coloured pictures, or any library drawing (src/components/art/drawing-library.ts). */
  art: string
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
const SMALL = [w("100 கிராம்", "100 g"), w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg")]
const LITRE = [w("1 லிட்டர்", "1 litre"), w("½ லிட்டர்", "½ litre")]
const BOTTLE = [w("1 லிட்டர் பாட்டில்", "1 litre bottle"), w("½ லிட்டர் பாட்டில்", "½ litre bottle"), w("200 மி.லி. பாட்டில்", "200 ml bottle")]
const BAG = [w("25 கிலோ மூட்டை", "25 kg bag"), w("50 கிலோ மூட்டை", "50 kg bag")]
const ORGANIC = yesno("natural", "இயற்கை முறை", "Natural farming")
const CUT = choice("cut", "வெட்டு", "Cut", [w("முழுசு", "Whole"), w("கறிக்கு", "Curry cut"), w("எலும்பில்லாதது", "Boneless"), w("கொத்துக்கறி", "Mince")])

/**
 * Farm For You's starter list: what South Indian farms sell, by module, each with its own drawing, usual sizes and
 * the details customers ask about. Admin loads it in one tap and changes it freely (src/server/product-kinds.ts).
 * src/domain/product-kinds.test.ts checks every drawing exists and every product on the coverage list has a kind.
 */
export const STARTER_KINDS: KindDef[] = [
  // ── Poultry ──
  kind({
    key: "eggs", module: "poultry", nameTa: "முட்டை", nameEn: "Eggs", art: "eggTray", measure: "count", hsn: "0407", shelfLifeDays: 21,
    packs: [w("6 முட்டை", "6 eggs"), w("12 முட்டை", "12 eggs"), w("30 முட்டை (தட்டு)", "Tray of 30")],
    details: [choice("egg_type", "முட்டை வகை", "Egg type", [w("நாட்டுக் கோழி", "Country hen"), w("லேயர்", "Layer"), w("வாத்து", "Duck"), w("காடை", "Quail"), w("வான்கோழி", "Turkey")], true), choice("size", "அளவு", "Size", [w("சிறியது", "Small"), w("நடுத்தரம்", "Medium"), w("பெரியது", "Large")])],
  }),
  kind({ key: "hatching_eggs", module: "poultry", nameTa: "குஞ்சு பொரிக்கும் முட்டை", nameEn: "Hatching eggs", art: "nestHen", measure: "count", packs: [w("10 முட்டை", "10 eggs"), w("30 முட்டை", "30 eggs")], details: [choice("bird", "பறவை", "Bird", [w("நாட்டுக் கோழி", "Country chicken"), w("கடக்நாத்", "Kadaknath"), w("வாத்து", "Duck"), w("காடை", "Quail"), w("வான்கோழி", "Turkey")], true)] }),
  kind({
    key: "live_birds", module: "poultry", nameTa: "உயிருள்ள பறவைகள்", nameEn: "Live birds", art: "hen", measure: "count",
    packs: [w("1 பறவை", "1 bird"), w("1 ஜோடி", "1 pair")],
    details: [choice("bird", "பறவை", "Bird", [w("நாட்டுக் கோழி", "Country chicken"), w("சேவல்", "Rooster"), w("கடக்நாத்", "Kadaknath"), w("பிராய்லர்", "Broiler"), w("வாத்து", "Duck"), w("காடை", "Quail"), w("வான்கோழி", "Turkey"), w("கினிக்கோழி", "Guinea fowl")], true), numberOf("weight_kg", "சுமார் எடை (கிலோ)", "About (kg)")],
  }),
  kind({ key: "chicks", module: "poultry", nameTa: "குஞ்சுகள்", nameEn: "Chicks & ducklings", art: "chick", measure: "count", packs: [w("10 குஞ்சு", "10 chicks"), w("25 குஞ்சு", "25 chicks")], details: [choice("bird", "பறவை", "Bird", [w("நாட்டுக் கோழி", "Country chicken"), w("கடக்நாத்", "Kadaknath"), w("வாத்து", "Duck"), w("காடை", "Quail"), w("வான்கோழி", "Turkey")], true), numberOf("age_days", "வயது (நாள்)", "Age (days)"), yesno("vaccinated", "தடுப்பூசி போட்டது", "Vaccinated")] }),
  kind({
    key: "dressed_poultry", module: "poultry", nameTa: "சுத்தம் செய்த கோழி", nameEn: "Dressed chicken & poultry", art: "chickenLeg", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 2, hsn: "0207",
    packs: KG,
    details: [choice("bird", "பறவை", "Bird", [w("நாட்டுக் கோழி", "Country chicken"), w("பிராய்லர்", "Broiler"), w("வாத்து", "Duck"), w("காடை", "Quail"), w("வான்கோழி", "Turkey")], true), CUT, yesno("with_skin", "தோலுடன்", "With skin")],
  }),
  kind({ key: "poultry_manure", module: "poultry", nameTa: "கோழி எரு", nameEn: "Poultry manure", art: "compost", measure: "weight", packs: BAG, details: [] }),
  // ── Livestock ──
  kind({
    key: "milk", module: "livestock", nameTa: "பால்", nameEn: "Milk", art: "cow", measure: "volume", shelfLifeDays: 1, hsn: "0401",
    packs: LITRE,
    details: [choice("animal", "விலங்கு", "Animal", [w("பசு", "Cow"), w("எருமை", "Buffalo"), w("ஆடு", "Goat")], true), yesno("a2", "A2", "A2"), choice("breed", "இனம்", "Breed", [w("நாட்டு மாடு", "Native"), w("காங்கேயம்", "Kangayam"), w("கிர்", "Gir"), w("சாஹிவால்", "Sahiwal"), w("கலப்பினம்", "Cross-bred")]), numberOf("fat", "கொழுப்பு %", "Fat %")],
  }),
  kind({ key: "curd", module: "livestock", nameTa: "தயிர்", nameEn: "Curd", art: "curdPot", measure: "weight", shelfLifeDays: 3, hsn: "0403", packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("animal", "விலங்கு", "Animal", [w("பசு", "Cow"), w("எருமை", "Buffalo")])] }),
  kind({ key: "buttermilk", module: "livestock", nameTa: "மோர்", nameEn: "Buttermilk", art: "buttermilk", measure: "volume", shelfLifeDays: 2, packs: [w("½ லிட்டர்", "½ litre"), w("1 லிட்டர்", "1 litre")], details: [yesno("spiced", "மசாலா மோர்", "Spiced")] }),
  kind({ key: "butter", module: "livestock", nameTa: "வெண்ணெய்", nameEn: "Butter", art: "butter", measure: "weight", shelfLifeDays: 15, hsn: "0405", gstRate: 12, packs: [w("100 கிராம்", "100 g"), w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg")], details: [] }),
  kind({ key: "ghee", module: "livestock", nameTa: "நெய்", nameEn: "Ghee", art: "gheeJar", measure: "volume", shelfLifeDays: 180, hsn: "0405", gstRate: 12, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("animal", "விலங்கு", "Animal", [w("பசு", "Cow"), w("எருமை", "Buffalo")]), yesno("bilona", "கடைந்த நெய்", "Bilona (hand-churned)")] }),
  kind({ key: "paneer", module: "livestock", nameTa: "பனீர்", nameEn: "Paneer", art: "paneer", measure: "weight", shelfLifeDays: 5, hsn: "0406", gstRate: 5, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg")], details: [] }),
  kind({ key: "milk_sweets", module: "livestock", nameTa: "பால் இனிப்புகள் & கோவா", nameEn: "Milk sweets & khoa", art: "laddu", measure: "weight", shelfLifeDays: 7, gstRate: 5, packs: [w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg")], details: [choice("sweet", "இனிப்பு", "Sweet", [w("பால்கோவா", "Palkova"), w("கோவா", "Khoa"), w("பால் பேடா", "Peda"), w("ரசகுல்லா", "Rasagulla")])] }),
  kind({
    key: "goats_sheep", module: "livestock", nameTa: "ஆடு & செம்மறி", nameEn: "Goats & sheep", art: "goat", measure: "count", packs: [w("1 உருப்படி", "1 animal")],
    details: [choice("animal", "விலங்கு", "Animal", [w("வெள்ளாடு", "Goat"), w("செம்மறி", "Sheep")], true), choice("breed", "இனம்", "Breed", [w("கன்னி", "Kanni"), w("கொடி", "Kodi"), w("சேலம் கருப்பு", "Salem black"), w("தலைச்சேரி", "Tellicherry"), w("போயர்", "Boer"), w("மேச்சேரி", "Mecheri"), w("மெட்ராஸ் சிவப்பு", "Madras red"), w("ராமநாதபுரம் வெள்ளை", "Ramnad white")]), choice("sex", "பால்", "Sex", [w("கிடா", "Male"), w("பெட்டை", "Female")]), numberOf("age_months", "வயது (மாதம்)", "Age (months)"), numberOf("weight_kg", "எடை (கிலோ)", "Weight (kg)")],
  }),
  kind({
    key: "cattle", module: "livestock", nameTa: "மாடுகள் & கன்றுகள்", nameEn: "Cattle & calves", art: "bull", measure: "count", packs: [w("1 உருப்படி", "1 animal")],
    details: [choice("animal", "விலங்கு", "Animal", [w("கறவை மாடு", "Cow"), w("காளை", "Bull"), w("கன்று", "Calf"), w("எருமை", "Buffalo")], true), choice("breed", "இனம்", "Breed", [w("காங்கேயம்", "Kangayam"), w("உம்பளச்சேரி", "Umblachery"), w("புலிக்குளம்", "Pulikulam"), w("பர்கூர்", "Bargur"), w("ஆலம்பாடி", "Alambadi"), w("முர்ரா", "Murrah"), w("ஜெர்சி கலப்பு", "Jersey cross"), w("HF கலப்பு", "HF cross")]), numberOf("milk_litres", "தினப் பால் (லிட்டர்)", "Milk a day (litres)"), numberOf("age_months", "வயது (மாதம்)", "Age (months)")],
  }),
  kind({ key: "pigs", module: "livestock", nameTa: "பன்றிகள்", nameEn: "Pigs", art: "pig", measure: "count", packs: [w("1 உருப்படி", "1 animal")], details: [numberOf("weight_kg", "எடை (கிலோ)", "Weight (kg)")] }),
  kind({ key: "rabbits", module: "livestock", nameTa: "முயல்கள்", nameEn: "Rabbits", art: "rabbit", measure: "count", packs: [w("1 உருப்படி", "1 animal"), w("1 ஜோடி", "1 pair")], details: [] }),
  kind({
    key: "meat", module: "livestock", nameTa: "இறைச்சி", nameEn: "Mutton & meat", art: "meatCut", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 2, hsn: "0204", packs: KG,
    details: [choice("animal", "விலங்கு", "Animal", [w("ஆடு", "Goat"), w("செம்மறி", "Sheep"), w("பன்றி", "Pork"), w("முயல்", "Rabbit")], true), CUT],
  }),
  kind({ key: "dung_cakes", module: "livestock", nameTa: "வறட்டி", nameEn: "Dung cakes", art: "dungCakes", measure: "count", packs: [w("10 வறட்டி", "10 cakes"), w("50 வறட்டி", "50 cakes")], details: [] }),
  kind({ key: "manure", module: "livestock", nameTa: "எரு & உரம்", nameEn: "Farmyard manure & compost", art: "compost", measure: "weight", packs: [...BAG, w("1 டிராக்டர் லோடு", "1 tractor load")], details: [choice("type", "வகை", "Type", [w("தொழு உரம்", "Farmyard manure"), w("மக்கிய உரம்", "Compost"), w("ஆட்டு எரு", "Goat manure")])] }),
  kind({ key: "vermicompost", module: "livestock", nameTa: "மண்புழு உரம்", nameEn: "Vermicompost & earthworms", art: "earthworm", measure: "weight", packs: [w("5 கிலோ", "5 kg"), w("25 கிலோ மூட்டை", "25 kg bag"), w("1 கிலோ புழு", "1 kg worms")], details: [] }),
  kind({ key: "panchagavya", module: "livestock", nameTa: "பஞ்சகவ்யம் & ஜீவாமிர்தம்", nameEn: "Panchagavya & jeevamirtham", art: "panchagavya", measure: "volume", shelfLifeDays: 90, packs: [w("1 லிட்டர்", "1 litre"), w("5 லிட்டர் கேன்", "5 litre can")], details: [choice("type", "வகை", "Type", [w("பஞ்சகவ்யம்", "Panchagavya"), w("ஜீவாமிர்தம்", "Jeevamirtham"), w("மீன் அமிலம்", "Fish amino"), w("கோமியம்", "Cow urine")], true)] }),
  kind({ key: "fodder", module: "livestock", nameTa: "தீவனம்", nameEn: "Fodder", art: "hayBale", measure: "weight", packs: [w("1 கட்டு", "1 bundle"), w("1 டிராக்டர் லோடு", "1 tractor load"), w("50 கிலோ மூட்டை", "50 kg bag")], details: [choice("type", "வகை", "Type", [w("வைக்கோல்", "Paddy straw"), w("பசுந்தீவனம்", "Green fodder"), w("ஊறுகாய் புல்", "Silage"), w("அடர் தீவனம்", "Cattle feed")], true)] }),
  // ── Fishery ──
  kind({
    key: "fish", module: "fishery", nameTa: "மீன்", nameEn: "Fresh fish", art: "fish", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 1, hsn: "0302", packs: KG,
    details: [choice("species", "மீன் வகை", "Fish", [w("ரோகு", "Rohu"), w("கட்லா", "Catla"), w("மிர்கால்", "Mrigal"), w("சாதா கெண்டை", "Common carp"), w("புல் கெண்டை", "Grass carp"), w("திலாப்பியா", "Tilapia"), w("விரால்", "Murrel"), w("பங்காசியஸ்", "Pangasius"), w("கரிமீன்", "Pearl spot"), w("பால் மீன்", "Milkfish"), w("கொடுவா", "Seabass")], true), choice("state", "நிலை", "As", [w("உயிருடன்", "Live"), w("புதியது", "Fresh"), w("சுத்தம் செய்தது", "Cleaned")]), choice("cut", "வெட்டு", "Cut", [w("முழுசு", "Whole"), w("துண்டுகள்", "Slices"), w("முள் இல்லாதது", "Fillet")])],
  }),
  kind({ key: "prawns", module: "fishery", nameTa: "இறால்", nameEn: "Prawns & shrimp", art: "prawn", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 1, hsn: "0306", packs: KG, details: [choice("type", "வகை", "Type", [w("நன்னீர் இறால்", "Freshwater prawn"), w("புலி இறால்", "Tiger prawn"), w("வனாமி", "Vannamei")], true), numberOf("count_per_kg", "கிலோவுக்கு எண்ணிக்கை", "Count per kg"), yesno("cleaned", "சுத்தம் செய்தது", "Cleaned")] }),
  kind({ key: "crabs", module: "fishery", nameTa: "நண்டு", nameEn: "Crabs", art: "crab", measure: "weight", weighedOnDelivery: true, shelfLifeDays: 1, packs: KG, details: [choice("type", "வகை", "Type", [w("சேற்று நண்டு", "Mud crab"), w("வயல் நண்டு", "Field crab")]), yesno("live", "உயிருடன்", "Live")] }),
  kind({ key: "dried_fish", module: "fishery", nameTa: "கருவாடு", nameEn: "Dried fish", art: "driedFish", measure: "weight", shelfLifeDays: 90, packs: SMALL, details: [choice("fish", "மீன்", "Fish", [w("நெத்திலி", "Anchovy (nethili)"), w("வாளை", "Ribbonfish"), w("சூரை", "Tuna"), w("இறால்", "Prawn")])] }),
  kind({ key: "fingerlings", module: "fishery", nameTa: "மீன் குஞ்சுகள்", nameEn: "Fingerlings & fish seed", art: "fingerlings", measure: "count", packs: [w("100 குஞ்சு", "100 fingerlings"), w("1000 குஞ்சு", "1000 fingerlings")], details: [choice("species", "மீன் வகை", "Fish", [w("ரோகு", "Rohu"), w("கட்லா", "Catla"), w("மிர்கால்", "Mrigal"), w("புல் கெண்டை", "Grass carp"), w("திலாப்பியா", "Tilapia"), w("விரால்", "Murrel"), w("நன்னீர் இறால்", "Freshwater prawn")], true), numberOf("size_cm", "அளவு (செ.மீ.)", "Size (cm)")] }),
  // ── Crops ──
  kind({ key: "paddy", module: "crops", nameTa: "நெல்", nameEn: "Paddy", art: "sheaf", measure: "weight", packs: [w("75 கிலோ மூட்டை", "75 kg bag"), w("1 மரக்கால்", "1 marakkal")], details: [choice("variety", "ரகம்", "Variety", [w("பொன்னி", "Ponni"), w("சீரக சம்பா", "Seeraga samba"), w("மாப்பிள்ளை சம்பா", "Mappillai samba"), w("கருப்புக் கவுனி", "Karuppu kavuni"), w("ADT", "ADT"), w("கோ", "CO")])] }),
  kind({ key: "rice", module: "crops", nameTa: "அரிசி", nameEn: "Rice", art: "riceSack", measure: "weight", shelfLifeDays: 180, hsn: "1006", packs: [w("1 கிலோ", "1 kg"), w("5 கிலோ", "5 kg"), w("25 கிலோ மூட்டை", "25 kg bag")], details: [choice("variety", "ரகம்", "Variety", [w("பொன்னி", "Ponni"), w("சீரக சம்பா", "Seeraga samba"), w("மாப்பிள்ளை சம்பா", "Mappillai samba"), w("கருப்புக் கவுனி", "Karuppu kavuni"), w("காட்டுயானம்", "Kattuyanam"), w("தூயமல்லி", "Thooyamalli"), w("இட்லி அரிசி", "Idli rice")]), choice("type", "வகை", "Type", [w("பச்சரிசி", "Raw"), w("புழுங்கல்", "Boiled")]), yesno("hand_pounded", "கைக்குத்தல்", "Hand-pounded"), ORGANIC] }),
  kind({ key: "millets", module: "crops", nameTa: "சிறுதானியங்கள்", nameEn: "Millets", art: "ragi", measure: "weight", shelfLifeDays: 180, packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("millet", "தானியம்", "Millet", [w("கேழ்வரகு", "Ragi"), w("கம்பு", "Kambu"), w("சோளம்", "Cholam (jowar)"), w("தினை", "Thinai"), w("சாமை", "Samai"), w("வரகு", "Varagu"), w("குதிரைவாலி", "Kuthiraivali"), w("பனிவரகு", "Panivaragu")], true), ORGANIC] }),
  kind({ key: "pulses", module: "crops", nameTa: "பருப்பு வகைகள்", nameEn: "Pulses & dal", art: "pulses", measure: "weight", shelfLifeDays: 180, hsn: "0713", packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("pulse", "பருப்பு", "Pulse", [w("துவரை", "Toor"), w("உளுந்து", "Urad"), w("பாசிப்பயறு", "Moong"), w("கொண்டைக்கடலை", "Chana"), w("கொள்ளு", "Horse gram"), w("தட்டைப்பயறு", "Cowpea"), w("மொச்சை", "Field beans")], true), choice("form", "வடிவம்", "As", [w("முழுசு", "Whole"), w("உடைத்தது", "Split")])] }),
  kind({ key: "maize", module: "crops", nameTa: "மக்காச்சோளம்", nameEn: "Maize & corn", art: "corn", measure: "weight", packs: [w("1 கிலோ", "1 kg"), w("1 கதிர்", "1 cob"), w("50 கிலோ மூட்டை", "50 kg bag")], details: [choice("type", "வகை", "Type", [w("இனிப்புச் சோளம்", "Sweet corn"), w("மக்காச்சோளம்", "Field maize")])] }),
  kind({ key: "oilseeds", module: "crops", nameTa: "நிலக்கடலை & எண்ணெய் வித்துக்கள்", nameEn: "Groundnut & oilseeds", art: "groundnut", measure: "weight", packs: [w("1 கிலோ", "1 kg"), w("40 கிலோ மூட்டை", "40 kg bag")], details: [choice("seed", "வித்து", "Seed", [w("நிலக்கடலை", "Groundnut"), w("எள்", "Sesame"), w("சூரியகாந்தி", "Sunflower"), w("ஆமணக்கு", "Castor")], true), choice("form", "வடிவம்", "As", [w("தோலுடன்", "In shell"), w("பருப்பு", "Kernels")])] }),
  kind({ key: "vegetables", module: "crops", nameTa: "காய்கறிகள்", nameEn: "Vegetables", art: "vegBasket", measure: "weight", shelfLifeDays: 4, packs: [w("¼ கிலோ", "¼ kg"), w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [ORGANIC] }),
  kind({ key: "greens", module: "crops", nameTa: "கீரைகள்", nameEn: "Greens (keerai)", art: "keerai", measure: "count", shelfLifeDays: 2, packs: [w("1 கட்டு", "1 bunch")], details: [choice("keerai", "கீரை", "Greens", [w("அரைக்கீரை", "Arai keerai"), w("சிறுகீரை", "Siru keerai"), w("முளைக்கீரை", "Mulai keerai"), w("பாலக்கீரை", "Palak"), w("பொன்னாங்கண்ணி", "Ponnanganni"), w("அகத்திக்கீரை", "Agathi keerai"), w("முருங்கைக்கீரை", "Moringa leaves"), w("வெந்தயக்கீரை", "Methi")]), ORGANIC] }),
  kind({ key: "herbs", module: "crops", nameTa: "மூலிகைகள்", nameEn: "Herbs & leaves", art: "curryLeaf", measure: "count", shelfLifeDays: 3, packs: [w("1 கட்டு", "1 bunch"), w("100 கிராம்", "100 g")], details: [choice("herb", "மூலிகை", "Herb", [w("கறிவேப்பிலை", "Curry leaf"), w("புதினா", "Mint"), w("கொத்தமல்லி", "Coriander"), w("துளசி", "Tulsi"), w("கற்றாழை", "Aloe vera"), w("தூதுவளை", "Thoothuvalai"), w("வல்லாரை", "Vallarai")], true)] }),
  kind({ key: "fruits", module: "crops", nameTa: "பழங்கள்", nameEn: "Fruits", art: "mango", measure: "weight", shelfLifeDays: 5, packs: [w("1 கிலோ", "1 kg"), w("½ கிலோ", "½ kg"), w("1 டஜன்", "1 dozen")], details: [choice("fruit", "பழம்", "Fruit", [w("மாம்பழம்", "Mango"), w("கொய்யா", "Guava"), w("பப்பாளி", "Papaya"), w("பலாப்பழம்", "Jackfruit"), w("சப்போட்டா", "Sapota"), w("மாதுளை", "Pomegranate"), w("எலுமிச்சை", "Lemon"), w("தர்பூசணி", "Watermelon"), w("நெல்லிக்காய்", "Amla"), w("சீதாப்பழம்", "Custard apple")]), ORGANIC] }),
  kind({ key: "bananas", module: "crops", nameTa: "வாழைப்பழம்", nameEn: "Bananas", art: "bananaBunch", measure: "count", shelfLifeDays: 5, packs: [w("1 சீப்பு", "1 hand"), w("1 டஜன்", "1 dozen"), w("1 தார்", "1 bunch")], details: [choice("variety", "ரகம்", "Variety", [w("பூவன்", "Poovan"), w("ரஸ்தாளி", "Rasthali"), w("நேந்திரன்", "Nendran"), w("கற்பூரவள்ளி", "Karpooravalli"), w("செவ்வாழை", "Red banana"), w("மொந்தன்", "Monthan"), w("பச்சை நாடன்", "Pachai nadan")], true)] }),
  kind({ key: "banana_leaf", module: "crops", nameTa: "வாழை இலை & பூ & தண்டு", nameEn: "Banana leaf, flower & stem", art: "bananaLeaf", measure: "count", shelfLifeDays: 3, packs: [w("10 இலை", "10 leaves"), w("1 பூ", "1 flower"), w("1 தண்டு", "1 stem")], details: [choice("part", "பகுதி", "Part", [w("இலை", "Leaf"), w("பூ", "Flower"), w("தண்டு", "Stem")], true)] }),
  kind({ key: "coconut", module: "crops", nameTa: "தேங்காய் & இளநீர்", nameEn: "Coconut & tender coconut", art: "tenderCoconut", measure: "count", packs: [w("1 காய்", "1 nut"), w("10 காய்", "10 nuts")], details: [choice("type", "வகை", "Type", [w("தேங்காய்", "Coconut"), w("இளநீர்", "Tender coconut"), w("கொப்பரை", "Copra")], true)] }),
  kind({ key: "sugarcane", module: "crops", nameTa: "கரும்பு", nameEn: "Sugarcane", art: "sugarcane", measure: "count", packs: [w("1 கரும்பு", "1 cane"), w("1 கட்டு (10)", "1 bundle (10)")], details: [] }),
  kind({ key: "jaggery", module: "crops", nameTa: "வெல்லம் & கருப்பட்டி", nameEn: "Jaggery & palm jaggery", art: "jaggery", measure: "weight", shelfLifeDays: 180, hsn: "1701", packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("type", "வகை", "Type", [w("வெல்லம்", "Cane jaggery"), w("கருப்பட்டி", "Palm jaggery"), w("நாட்டுச் சர்க்கரை", "Jaggery powder")], true), yesno("chemical_free", "ரசாயனம் இல்லாதது", "No chemicals")] }),
  kind({ key: "turmeric", module: "crops", nameTa: "மஞ்சள்", nameEn: "Turmeric", art: "turmeric", measure: "weight", shelfLifeDays: 365, hsn: "0910", gstRate: 5, packs: SMALL, details: [choice("form", "வடிவம்", "As", [w("விரலி", "Fingers"), w("தூள்", "Powder"), w("பச்சை", "Fresh")])] }),
  kind({ key: "spices", module: "crops", nameTa: "மசாலாப் பொருட்கள்", nameEn: "Spices", art: "spiceBowls", measure: "weight", shelfLifeDays: 365, gstRate: 5, packs: SMALL, details: [choice("spice", "மசாலா", "Spice", [w("மிளகு", "Pepper"), w("ஏலக்காய்", "Cardamom"), w("இலவங்கப்பட்டை", "Cinnamon"), w("கிராம்பு", "Clove"), w("மிளகாய் வற்றல்", "Dry chilli"), w("மல்லி விதை", "Coriander seed"), w("சீரகம்", "Cumin"), w("கடுகு", "Mustard")], true)] }),
  kind({ key: "tamarind", module: "crops", nameTa: "புளி", nameEn: "Tamarind", art: "tamarind", measure: "weight", shelfLifeDays: 365, packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [yesno("seedless", "கொட்டை நீக்கியது", "Seedless")] }),
  kind({ key: "flowers", module: "crops", nameTa: "பூக்கள்", nameEn: "Flowers", art: "marigold", measure: "weight", shelfLifeDays: 1, packs: [w("100 கிராம்", "100 g"), w("¼ கிலோ", "¼ kg"), w("1 கிலோ", "1 kg")], details: [choice("flower", "பூ", "Flower", [w("மல்லிகை", "Jasmine"), w("முல்லை", "Mullai"), w("கனகாம்பரம்", "Kanakambaram"), w("சாமந்தி", "Marigold"), w("செவ்வந்தி", "Chrysanthemum"), w("ரோஜா", "Rose"), w("சம்பங்கி", "Tuberose"), w("தாமரை", "Lotus"), w("அரளி", "Arali")], true)] }),
  kind({ key: "garlands", module: "crops", nameTa: "பூச்சரம் & மாலை", nameEn: "Flower strings & garlands", art: "jasmine", measure: "count", shelfLifeDays: 1, packs: [w("1 முழம்", "1 muzham"), w("1 மாலை", "1 garland")], details: [choice("flower", "பூ", "Flower", [w("மல்லிகை", "Jasmine"), w("முல்லை", "Mullai"), w("கனகாம்பரம்", "Kanakambaram"), w("ரோஜா", "Rose"), w("சாமந்தி", "Marigold")])] }),
  kind({ key: "arecanut", module: "crops", nameTa: "பாக்கு", nameEn: "Arecanut", art: "arecanut", measure: "weight", packs: [w("1 கிலோ", "1 kg"), w("50 கிலோ மூட்டை", "50 kg bag")], details: [choice("form", "வடிவம்", "As", [w("பழுத்தது", "Ripe"), w("உலர்ந்தது", "Dried"), w("வெட்டியது", "Cut")])] }),
  kind({ key: "coffee", module: "crops", nameTa: "காபி", nameEn: "Coffee", art: "coffee", measure: "weight", shelfLifeDays: 180, gstRate: 5, packs: [w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("form", "வடிவம்", "As", [w("பச்சைக் கொட்டை", "Green beans"), w("வறுத்த கொட்டை", "Roasted beans"), w("தூள்", "Powder")], true), choice("type", "வகை", "Type", [w("அரபிகா", "Arabica"), w("ரோபஸ்டா", "Robusta")])] }),
  kind({ key: "tea", module: "crops", nameTa: "தேயிலை", nameEn: "Tea", art: "tea", measure: "weight", shelfLifeDays: 365, gstRate: 5, packs: [w("100 கிராம்", "100 g"), w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg")], details: [choice("type", "வகை", "Type", [w("தூள்", "Dust"), w("இலை", "Leaf"), w("பச்சைத் தேயிலை", "Green tea")])] }),
  kind({ key: "cashew", module: "crops", nameTa: "முந்திரி", nameEn: "Cashew", art: "cashew", measure: "weight", shelfLifeDays: 180, gstRate: 5, packs: SMALL, details: [choice("form", "வடிவம்", "As", [w("கொட்டை", "Raw nuts"), w("பருப்பு", "Kernels")])] }),
  kind({ key: "cotton", module: "crops", nameTa: "பருத்தி", nameEn: "Cotton", art: "cotton", measure: "weight", packs: [w("1 குவிண்டால்", "1 quintal")], details: [] }),
  kind({ key: "silk", module: "crops", nameTa: "பட்டுக்கூடு", nameEn: "Silk cocoons", art: "cocoon", measure: "weight", packs: [w("1 கிலோ", "1 kg")], details: [] }),
  kind({ key: "mushrooms", module: "crops", nameTa: "காளான்", nameEn: "Mushrooms", art: "mushroom", measure: "weight", shelfLifeDays: 2, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg")], details: [choice("type", "வகை", "Type", [w("சிப்பிக் காளான்", "Oyster"), w("பால் காளான்", "Milky"), w("பட்டன் காளான்", "Button")])] }),
  kind({ key: "seeds", module: "crops", nameTa: "விதைகள்", nameEn: "Seeds", art: "seedPacket", measure: "weight", packs: [w("1 பாக்கெட்", "1 packet"), w("100 கிராம்", "100 g"), w("1 கிலோ", "1 kg")], details: [yesno("native", "நாட்டு விதை", "Native seed")] }),
  kind({ key: "seedlings", module: "crops", nameTa: "நாற்றுகள் & கன்றுகள்", nameEn: "Seedlings & saplings", art: "saplingPot", measure: "count", packs: [w("1 கன்று", "1 plant"), w("10 நாற்று", "10 seedlings")], details: [choice("type", "வகை", "Type", [w("காய்கறி நாற்று", "Vegetable seedlings"), w("பழ மரக்கன்று", "Fruit sapling"), w("மரக்கன்று", "Tree sapling"), w("பூச்செடி", "Flower plant"), w("தென்னங்கன்று", "Coconut seedling")])] }),
  kind({ key: "firewood", module: "crops", nameTa: "விறகு", nameEn: "Firewood", art: "firewood", measure: "weight", packs: [w("1 கட்டு", "1 bundle"), w("1 டிராக்டர் லோடு", "1 tractor load")], details: [] }),
  // ── Value-added (Selling) ──
  kind({ key: "oils", module: "selling", nameTa: "செக்கு எண்ணெய்", nameEn: "Cold-pressed oils", art: "oilBottle", measure: "volume", shelfLifeDays: 180, gstRate: 5, packs: BOTTLE, details: [choice("oil", "எண்ணெய்", "Oil", [w("நல்லெண்ணெய்", "Gingelly"), w("கடலை எண்ணெய்", "Groundnut"), w("தேங்காய் எண்ணெய்", "Coconut"), w("விளக்கெண்ணெய்", "Castor"), w("இலுப்பை எண்ணெய்", "Iluppai")], true), yesno("wood_pressed", "மரச்செக்கு", "Wood-pressed")] }),
  kind({ key: "honey", module: "selling", nameTa: "தேன்", nameEn: "Honey", art: "honeyJar", measure: "weight", shelfLifeDays: 365, packs: [w("250 கிராம்", "250 g"), w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("type", "வகை", "Type", [w("காட்டுத் தேன்", "Wild honey"), w("கொம்புத் தேன்", "Rock bee"), w("பெட்டித் தேன்", "Bee-box honey"), w("முருங்கைத் தேன்", "Moringa honey")])] }),
  kind({ key: "pickles", module: "selling", nameTa: "ஊறுகாய் & தொக்கு", nameEn: "Pickles & thokku", art: "bharani", measure: "weight", shelfLifeDays: 180, gstRate: 12, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg")], details: [choice("pickle", "ஊறுகாய்", "Pickle", [w("மாங்காய்", "Mango"), w("எலுமிச்சை", "Lemon"), w("நார்த்தங்காய்", "Citron"), w("பூண்டு", "Garlic"), w("தக்காளி தொக்கு", "Tomato thokku"), w("இஞ்சி", "Ginger")])] }),
  kind({ key: "podi", module: "selling", nameTa: "பொடி & மசாலாத் தூள்", nameEn: "Podi & masala powders", art: "podiJar", measure: "weight", shelfLifeDays: 120, gstRate: 5, packs: [w("100 கிராம்", "100 g"), w("250 கிராம்", "250 g")], details: [choice("podi", "பொடி", "Powder", [w("இட்லிப் பொடி", "Idli podi"), w("பருப்புப் பொடி", "Paruppu podi"), w("கறிவேப்பிலைப் பொடி", "Curry leaf podi"), w("சாம்பார் பொடி", "Sambar powder"), w("ரசப் பொடி", "Rasam powder"), w("மிளகாய்த் தூள்", "Chilli powder")])] }),
  kind({ key: "flours", module: "selling", nameTa: "மாவு & மாவுக் கலவை", nameEn: "Flours & batter", art: "flourBag", measure: "weight", shelfLifeDays: 60, packs: [w("½ கிலோ", "½ kg"), w("1 கிலோ", "1 kg")], details: [choice("flour", "மாவு", "Flour", [w("கேழ்வரகு மாவு", "Ragi flour"), w("கம்பு மாவு", "Kambu flour"), w("அரிசி மாவு", "Rice flour"), w("சத்து மாவு", "Health mix"), w("இட்லி/தோசை மாவு", "Idli/dosa batter"), w("கோதுமை மாவு", "Wheat flour")])] }),
  kind({ key: "snacks", module: "selling", nameTa: "தின்பண்டங்கள் & இனிப்புகள்", nameEn: "Snacks & sweets", art: "murukku", measure: "weight", shelfLifeDays: 30, gstRate: 5, packs: [w("200 கிராம்", "200 g"), w("½ கிலோ", "½ kg")], details: [choice("item", "பண்டம்", "Item", [w("முறுக்கு", "Murukku"), w("சீடை", "Seedai"), w("அதிரசம்", "Athirasam"), w("கடலை மிட்டாய்", "Kadalai mittai"), w("எள்ளுருண்டை", "Ellu urundai"), w("லட்டு", "Laddu"), w("அல்வா", "Halwa")])] }),
  kind({ key: "appalam", module: "selling", nameTa: "அப்பளம் & வற்றல் & வடகம்", nameEn: "Appalam, vathal & vadagam", art: "appalam", measure: "weight", shelfLifeDays: 180, packs: [w("100 கிராம்", "100 g"), w("250 கிராம்", "250 g")], details: [choice("item", "பொருள்", "Item", [w("அப்பளம்", "Appalam"), w("மோர் மிளகாய்", "Mor milagai"), w("சுண்டைக்காய் வற்றல்", "Sundakkai vathal"), w("வடகம்", "Vadagam"), w("கொத்தவரங்காய் வற்றல்", "Kothavarangai vathal")])] }),
  kind({ key: "natural_care", module: "selling", nameTa: "இயற்கை பராமரிப்புப் பொருட்கள்", nameEn: "Natural care products", art: "ural", measure: "weight", packs: [w("100 கிராம்", "100 g"), w("1 பாட்டில்", "1 bottle")], details: [choice("item", "பொருள்", "Item", [w("சீயக்காய்", "Shikakai"), w("அரப்பு", "Arappu"), w("பூந்திக்கொட்டை", "Soapnut"), w("மூலிகைச் சோப்பு", "Herbal soap"), w("பல்பொடி", "Tooth powder")])] }),
  // ── Services ──
  kind({ key: "tractor_hire", module: "selling", nameTa: "டிராக்டர் & உழவு வாடகை", nameEn: "Tractor & ploughing hire", art: "tractor", measure: "count", packs: [w("1 மணி நேரம்", "1 hour"), w("1 ஏக்கர்", "1 acre")], details: [choice("work", "வேலை", "Work", [w("உழவு", "Ploughing"), w("ரொட்டவேட்டர்", "Rotavator"), w("அறுவடை", "Harvesting"), w("ஏற்றிச் செல்லுதல்", "Transport")])] }),
  kind({ key: "farm_visits", module: "selling", nameTa: "பண்ணைச் சுற்றுலா", nameEn: "Farm visits & stays", art: "hut", measure: "count", packs: [w("1 நபர்", "1 person"), w("1 குடும்பம்", "1 family"), w("1 இரவு", "1 night")], details: [] }),
]
