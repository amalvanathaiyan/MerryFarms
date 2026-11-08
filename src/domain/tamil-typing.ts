const PULLI = "்"

/** Longest spellings first, so "aa" is never read as two "a"s. Capitals mean the long vowel. */
const VOWELS: [string, string, string][] = [
  ["aa", "ஆ", "ா"],
  ["ae", "ஏ", "ே"],
  ["ai", "ஐ", "ை"],
  ["au", "ஔ", "ௌ"],
  ["ee", "ஈ", "ீ"],
  ["ii", "ஈ", "ீ"],
  ["oa", "ஓ", "ோ"],
  ["oo", "ஊ", "ூ"],
  ["uu", "ஊ", "ூ"],
  ["a", "அ", ""],
  ["A", "ஆ", "ா"],
  ["i", "இ", "ி"],
  ["I", "ஈ", "ீ"],
  ["u", "உ", "ு"],
  ["U", "ஊ", "ூ"],
  ["e", "எ", "ெ"],
  ["E", "ஏ", "ே"],
  ["o", "ஒ", "ொ"],
  ["O", "ஓ", "ோ"],
]

/** Longest spellings first. Capitals pick the harder letter: N ண, L ள, R ற. */
const CONSONANTS: [string, string][] = [
  ["ndr", "ன்ற"],
  ["nch", "ஞ்ச"],
  ["nth", "ந்த"],
  ["ndh", "ந்த"],
  ["ksh", "க்ஷ"],
  ["nk", "ங்க"],
  ["nd", "ண்ட"],
  ["nt", "ண்ட"],
  ["nR", "ன்ற"],
  ["ch", "ச"],
  ["th", "த"],
  ["dh", "த"],
  ["sh", "ஷ"],
  ["zh", "ழ"],
  ["ny", "ஞ"],
  ["k", "க"],
  ["g", "க"],
  ["q", "க"],
  ["c", "ச"],
  ["s", "ச"],
  ["S", "ஸ"],
  ["t", "ட"],
  ["d", "ட"],
  ["n", "ன"],
  ["N", "ண"],
  ["p", "ப"],
  ["b", "ப"],
  ["f", "ஃப"],
  ["m", "ம"],
  ["y", "ய"],
  ["r", "ர"],
  ["R", "ற"],
  ["l", "ல"],
  ["L", "ள"],
  ["v", "வ"],
  ["w", "வ"],
  ["z", "ழ"],
  ["j", "ஜ"],
  ["h", "ஹ"],
  ["x", "க்ஸ"],
]

const vowelAt = (word: string, i: number) => VOWELS.find(([roman]) => word.startsWith(roman, i))

/** Which letter a consonant spelling is here. Tamil spells a few of them by what stands around them. */
function consonantAt(word: string, i: number): [string, string] {
  const rest = word.slice(i)
  // "ng" and "nj" before a vowel are the pairs ங்க and ஞ்ச, as in சங்கம், மஞ்சள்.
  if (rest.startsWith("ng")) return ["ng", vowelAt(word, i + 2) ? "ங்க" : "ங"]
  if (rest.startsWith("nj")) return ["nj", vowelAt(word, i + 2) ? "ஞ்ச" : "ஞ"]
  if (rest.startsWith("tr") && i > 0) return ["tr", "ற்ற"]
  if (rest[0] === "n" && i === 0 && !rest.startsWith("nk")) return ["n", "ந"]
  if (rest === "s") return ["s", "ஸ"]
  return (
    CONSONANTS.find(([roman]) => rest.startsWith(roman)) ??
    CONSONANTS.find(([roman]) => rest.toLowerCase().startsWith(roman)) ?? [rest[0], "க"]
  )
}

/** One word in English letters to Tamil by sound: thamizh → தமிழ். Rebuilt whole on every letter, so endings can change. */
export function toTamil(latin: string): string {
  // Phones capitalise the first letter of a box, and no Tamil word starts with ண, ள or ற.
  const word = latin.slice(0, 1).toLowerCase() + latin.slice(1)
  let out = ""
  let i = 0
  while (i < word.length) {
    const vowel = vowelAt(word, i)
    if (vowel) {
      out += vowel[1]
      i += vowel[0].length
      continue
    }
    const [roman, letter] = consonantAt(word, i)
    i += roman.length
    const sign = vowelAt(word, i)
    out += letter + (sign ? sign[2] : PULLI)
    if (sign) i += sign[0].length
  }
  return out
}

/** Text before the caret, and the English spelling of the word still being typed at its end. */
export type Typing = { text: string; word: string }

/**
 * Works out the text before the caret after an edit. Only letters typed since `prev` turn into Tamil, so
 * Tamil from a Tamil keyboard, numbers and spaces stay as they are, and Backspace takes off one English letter.
 */
export function typeTamil(prev: Typing, before: string): Typing {
  let same = 0
  while (same < prev.text.length && prev.text[same] === before[same]) same++
  const added = before.slice(same)
  const wordStart = prev.text.length - toTamil(prev.word).length
  const atEnd = same === prev.text.length

  if (!added) {
    if (atEnd) return { text: before, word: prev.word }
    // Backspace removes at most a vowel sign or a pulli from the screen; more than that was a selection.
    if (prev.word && same >= wordStart && prev.text.length - same <= 2) {
      const word = prev.word.slice(0, -1)
      return { text: prev.text.slice(0, wordStart) + toTamil(word), word }
    }
    return { text: before, word: "" }
  }

  let head = atEnd ? prev.text.slice(0, wordStart) : before.slice(0, same)
  let word = atEnd ? prev.word : ""
  for (const part of added.match(/[a-zA-Z]+|[^a-zA-Z]+/g) ?? []) {
    if (/[a-zA-Z]/.test(part)) word += part
    else {
      head += toTamil(word) + part
      word = ""
    }
  }
  return { text: head + toTamil(word), word }
}
