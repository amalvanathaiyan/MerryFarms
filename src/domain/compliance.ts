/**
 * Items against the law (docs/platform-plan.md §3.9), the pure part: the restricted items list's entries, matching a
 * farm's words against it, and what a match does. Tested; src/server/compliance.ts loads, saves and acts.
 *
 * Each entry has words in Tamil and English and an action:
 *   block    never allowed: the product is hidden until Farm For You allows it
 *   hold     maybe allowed: hidden until Farm For You looks
 *   licence  allowed once the farm's FSSAI licence is on file; hidden until then
 * Screening is switched off until the list is checked by someone who knows the law (§7); the starter list below
 * is only examples to begin from.
 */

export const RESTRICTED_ACTIONS = ["block", "hold", "licence"] as const
export type RestrictedAction = (typeof RESTRICTED_ACTIONS)[number]
export const isRestrictedAction = (v: unknown): v is RestrictedAction => typeof v === "string" && (RESTRICTED_ACTIONS as readonly string[]).includes(v)

export interface RestrictedEntry {
  id: string
  wordsTa: string[]
  wordsEn: string[]
  action: string
}

export interface Hit {
  itemId: string
  word: string
  action: RestrictedAction
}

/** Lower case, one space between words, Tamil in its composed form. */
export const normalise = (text: string) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim()

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * The first of an entry's words found in the text, or null. English words match whole words (and their plurals:
 * "turtle" finds "turtles", never "turtleneck"); Tamil words match anywhere, because Tamil joins endings onto words
 * ("மயில்" finds "மயில்கள்"). Tamil words that are common word endings on their own (like "கள்") must not be listed.
 */
export function matchEntry(text: string, entry: Pick<RestrictedEntry, "wordsTa" | "wordsEn">): string | null {
  const t = normalise(text)
  if (!t) return null
  for (const w of entry.wordsTa.map(normalise).filter(Boolean)) if (t.includes(w)) return w
  for (const w of entry.wordsEn.map(normalise).filter(Boolean)) {
    if (new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}(s|es)?($|[^\\p{L}\\p{N}])`, "u").test(t)) return w
  }
  return null
}

const SEVERITY: Record<RestrictedAction, number> = { block: 3, hold: 2, licence: 1 }

/**
 * Screens a farm's words (a product's names and notes, a category's names) against the list: the most serious match,
 * or null. A licence entry doesn't count once the farm's licence is on file.
 */
export function screen(texts: (string | null | undefined)[], entries: RestrictedEntry[], farm: { hasLicence: boolean }): Hit | null {
  const text = texts.filter(Boolean).join(" · ")
  let best: Hit | null = null
  for (const e of entries) {
    if (!isRestrictedAction(e.action)) continue
    if (e.action === "licence" && farm.hasLicence) continue
    const word = matchEntry(text, e)
    if (word && (!best || SEVERITY[e.action] > SEVERITY[best.action])) best = { itemId: e.id, word, action: e.action }
  }
  return best
}

/** Splits what admin typed ("peacock, peahen, peafowl") into words. */
export const splitWords = (text: string) => [...new Set(text.split(/[,\n]/).map((w) => w.trim()).filter((w) => w.length >= 2))].slice(0, 40)

// ── Cases ────────────────────────────────────────────────────────────────────

/** open: waiting for Farm For You. Then allowed, kept hidden, removed, or cleared (the farm changed the words). */
export const CASE_STATES = ["open", "allowed", "kept_hidden", "removed", "cleared"] as const
export type CaseState = (typeof CASE_STATES)[number]
export const CASE_DECISIONS = ["allowed", "kept_hidden", "removed"] as const
export type CaseDecision = (typeof CASE_DECISIONS)[number]

/** Cases that count against a farm: things it really listed that weren't allowed. */
export const COUNTS_AGAINST: readonly CaseState[] = ["kept_hidden", "removed"]

export interface ComplianceConfig {
  /** Screening on; off until the list is checked by a legal expert */
  on: boolean
  /** A farm with this many cases against it is shown to admin for review */
  repeatLimit: number
}

export const DEFAULT_CONFIG: ComplianceConfig = { on: false, repeatLimit: 3 }

export function cleanConfig(json: unknown): ComplianceConfig {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>
  const limit = Number(o.repeatLimit)
  return { on: o.on === true, repeatLimit: Number.isInteger(limit) && limit >= 1 && limit <= 20 ? limit : DEFAULT_CONFIG.repeatLimit }
}

// ── The starter list: examples to begin from, to be checked by a legal expert before screening is switched on ──

export interface StarterItem {
  labelTa: string
  labelEn: string
  wordsTa: string[]
  wordsEn: string[]
  action: RestrictedAction
  reasonTa: string
  reasonEn: string
}

const WILDLIFE_TA = "வனவிலங்குப் பாதுகாப்புச் சட்டத்தின் கீழ் பாதுகாக்கப்பட்டது; விற்க முடியாது."
const WILDLIFE_EN = "Protected under the Wildlife Protection Act; it can't be sold."

export const STARTER_ITEMS: StarterItem[] = [
  { labelTa: "மயில்", labelEn: "Peafowl", wordsTa: ["மயில்"], wordsEn: ["peacock", "peahen", "peafowl"], action: "block", reasonTa: WILDLIFE_TA, reasonEn: WILDLIFE_EN },
  { labelTa: "கிளி, முனியா", labelEn: "Parakeets and munias", wordsTa: ["கிளி", "முனியா"], wordsEn: ["parakeet", "parrot", "munia"], action: "hold", reasonTa: WILDLIFE_TA, reasonEn: WILDLIFE_EN },
  { labelTa: "ஆமை", labelEn: "Turtles and tortoises", wordsTa: ["ஆமை"], wordsEn: ["turtle", "tortoise"], action: "block", reasonTa: WILDLIFE_TA, reasonEn: WILDLIFE_EN },
  { labelTa: "காட்டுப்பன்றி", labelEn: "Wild boar", wordsTa: ["காட்டுப்பன்றி", "காட்டுப் பன்றி"], wordsEn: ["wild boar"], action: "block", reasonTa: WILDLIFE_TA, reasonEn: WILDLIFE_EN },
  { labelTa: "மான், உடும்பு", labelEn: "Deer and monitor lizard", wordsTa: ["மான் கறி", "உடும்பு"], wordsEn: ["deer", "venison", "monitor lizard"], action: "block", reasonTa: WILDLIFE_TA, reasonEn: WILDLIFE_EN },
  {
    labelTa: "தடைசெய்யப்பட்ட மீன்", labelEn: "Banned fish", wordsTa: ["ஆப்பிரிக்க கெளுத்தி", "தாய் மாகூர்", "தாய் மாங்கூர்"], wordsEn: ["african catfish", "thai magur", "thai mangur", "clarias gariepinus"], action: "block",
    reasonTa: "இந்த மீன் வளர்க்கவும் விற்கவும் தடை உள்ளது.", reasonEn: "Farming and selling this fish is banned.",
  },
  {
    labelTa: "கள், சாராயம்", labelEn: "Toddy and arrack", wordsTa: ["கள்ளு", "பனங்கள்", "தென்னங்கள்", "சாராயம்"], wordsEn: ["toddy", "arrack", "liquor", "palm wine"], action: "block",
    reasonTa: "மதுபானங்களை இங்கே விற்க முடியாது.", reasonEn: "Alcohol can't be sold here.",
  },
  {
    labelTa: "போதைச் செடிகள்", labelEn: "Narcotic plants", wordsTa: ["கஞ்சா", "அபின்"], wordsEn: ["ganja", "cannabis", "marijuana", "opium"], action: "block",
    reasonTa: "போதைப்பொருள் சட்டத்தின் கீழ் தடை.", reasonEn: "Banned under the narcotics law.",
  },
  {
    labelTa: "தடைசெய்யப்பட்ட பூச்சிக்கொல்லி", labelEn: "Banned pesticides", wordsTa: ["எண்டோசல்பான்"], wordsEn: ["endosulfan", "monocrotophos", "carbofuran"], action: "hold",
    reasonTa: "இந்தப் பூச்சிக்கொல்லி தடைசெய்யப்பட்டது அல்லது கட்டுப்பாட்டில் உள்ளது.", reasonEn: "This pesticide is banned or restricted.",
  },
  {
    labelTa: "அனுமதியில்லாத கால்நடை மருந்து", labelEn: "Banned animal medicines", wordsTa: ["டைக்ளோஃபெனாக்", "கொலிஸ்டின்"], wordsEn: ["diclofenac", "colistin", "oxytocin"], action: "hold",
    reasonTa: "கால்நடைகளுக்கு இந்த மருந்து தடைசெய்யப்பட்டது அல்லது கட்டுப்பாட்டில் உள்ளது.", reasonEn: "This medicine is banned or restricted for animals.",
  },
  {
    labelTa: "சண்டைச் சேவல்", labelEn: "Fighting birds", wordsTa: ["சண்டைச் சேவல்", "சண்டை சேவல்", "சேவல் சண்டை"], wordsEn: ["fighting cock", "game cock", "rooster fight"], action: "hold",
    reasonTa: "விலங்குச் சண்டைகள் சட்டப்படி தடை.", reasonEn: "Animal fights are banned by law.",
  },
  {
    labelTa: "பதப்படுத்திய உணவு", labelEn: "Packed and processed food", wordsTa: ["ஊறுகாய்", "நெய்", "தேன்"], wordsEn: ["pickle", "ghee", "honey"], action: "licence",
    reasonTa: "இதை விற்க FSSAI உரிமம் தேவை. உரிமத்தை Farm For You-க்கு அனுப்பியதும் காட்டப்படும்.", reasonEn: "Selling this needs an FSSAI licence. It shows once your licence is with Farm For You.",
  },
]
