/**
 * Product pictures for any kind of farm: which drawn placeholder fits a product that has
 * no photo yet, ready-made categories, and checks on uploaded photos (type by content).
 */

/** What a category holds; picks its drawing until the farm adds photos. "basket" = other. */
export const ART_KINDS = ["egg", "chicken", "milk", "dairy", "oil", "vegetables", "greens", "fruits", "grains", "honey", "spices", "pickles", "plants", "basket"] as const
export type ArtKind = (typeof ART_KINDS)[number]

export const isArtKind = (k: string | null | undefined): k is ArtKind => !!k && (ART_KINDS as readonly string[]).includes(k)

/**
 * Words that give a product's type away, Tamil and English, checked in this order:
 * specific before general ("நாட்டுக் கோழி முட்டை" is eggs, "கறிவேப்பிலை" is greens, not meat).
 */
const RULES: [ArtKind, RegExp][] = [
  ["egg", /egg|முட்டை/i],
  ["dairy", /ghee|butter|curd|paneer|cheese|yog(h)?urt|buttermilk|khoa|நெய்|வெண்ணெய்|தயிர்|மோர்|பனீர்|கோவா/i],
  ["milk", /milk|பால்/i],
  // "ண்ணெய்" covers எண்ணெய் and நல்லெண்ணெய்; வெண்ணெய் (butter) is caught as dairy first.
  ["oil", /\boil\b|ண்ணெய்|செக்கு/i],
  ["honey", /honey|தேன்/i],
  ["greens", /greens|spinach|keerai|leaves|மூலிகை|கீரை|கறிவேப்பிலை|புதினா|கொத்தமல்லி/i],
  ["spices", /spice|masala|turmeric|chilli|chili|pepper|cardamom|cumin|மஞ்சள்|மிளகு|மிளகாய்|மசாலா|ஏலக்காய்|சீரகம்/i],
  ["pickles", /pickle|podi|thokku|jam|papad|appalam|murukku|snack|sweet|jaggery|ஊறுகாய்|பொடி|தொக்கு|வெல்லம்|அப்பளம்|முறுக்கு|இனிப்பு/i],
  ["grains", /rice|millet|ragi|wheat|\bdal\b|pulses|flour|atta|samai|thinai|varagu|அரிசி|சிறுதானிய|கேழ்வரகு|ராகி|கம்பு|சோளம்|தினை|சாமை|வரகு|பருப்பு|மாவு/i],
  ["fruits", /fruit|mango|banana|guava|papaya|coconut|jackfruit|pazham|பழம்|பழங்க|வாழைப்பழ|கொய்யா|பப்பாளி|தேங்காய்|பலா/i],
  ["vegetables", /vegetable|tomato|onion|brinjal|okra|ladies finger|beans|drumstick|potato|carrot|காய்கறி|தக்காளி|வெங்காயம்|கத்தரி|வெண்டை|முருங்கை|பீன்ஸ்|காய்/i],
  ["chicken", /chicken|kozhi|\bhen\b|broiler|mutton|meat|goat|duck|quail|fish|கோழி|சிக்கன்|ஆட்டு|இறைச்சி|வாத்து|காடை|மீன்/i],
  ["plants", /plant|sapling|seedling|seeds?\b|நாற்று|விதை|செடி|மரக்கன்று/i],
]

/** Guesses the drawing from product and category names; first match wins. */
export function artKind(...texts: (string | null | undefined)[]): ArtKind {
  for (const t of texts) {
    if (!t) continue
    for (const [kind, re] of RULES) if (re.test(t)) return kind
  }
  return "basket"
}

/** The category's chosen type wins; otherwise guess from the names. */
export function artFor(categoryKind: string | null | undefined, ...texts: (string | null | undefined)[]): ArtKind {
  return isArtKind(categoryKind) && categoryKind !== "basket" ? categoryKind : artKind(...texts)
}

/** Ready-made categories a farm can add in one tap (names in both languages, with their type). */
export const STARTER_CATEGORIES: { kind: ArtKind; nameTa: string; nameEn: string }[] = [
  { kind: "egg", nameTa: "முட்டை", nameEn: "Eggs" },
  { kind: "chicken", nameTa: "நாட்டுக் கோழி", nameEn: "Country chicken" },
  { kind: "milk", nameTa: "பால்", nameEn: "Milk" },
  { kind: "dairy", nameTa: "நெய் & பால் பொருட்கள்", nameEn: "Ghee & dairy" },
  { kind: "oil", nameTa: "செக்கு எண்ணெய்", nameEn: "Cold-pressed oils" },
  { kind: "vegetables", nameTa: "காய்கறிகள்", nameEn: "Vegetables" },
  { kind: "greens", nameTa: "கீரைகள்", nameEn: "Greens" },
  { kind: "fruits", nameTa: "பழங்கள்", nameEn: "Fruits" },
  { kind: "grains", nameTa: "அரிசி & சிறுதானியங்கள்", nameEn: "Rice & millets" },
  { kind: "honey", nameTa: "தேன்", nameEn: "Honey" },
  { kind: "spices", nameTa: "மசாலா & பொடிகள்", nameEn: "Spices & powders" },
  { kind: "pickles", nameTa: "ஊறுகாய் & தயாரிப்புகள்", nameEn: "Pickles & homemade" },
  { kind: "plants", nameTa: "நாற்றுகள் & விதைகள்", nameEn: "Plants & seeds" },
]

export const MAX_PHOTO_BYTES = 400 * 1024

/** JPEG, PNG or WebP by their first bytes; anything else is refused. */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png"
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp"
  return null
}
