import { describe, expect, it } from "vitest"
import { toTamil, typeTamil, type Typing } from "./tamil-typing"

/** Types one change after another, as the box would see them: each entry is the text before the caret. */
const edits = (steps: ((text: string) => string)[], start: Typing = { text: "", word: "" }) =>
  steps.reduce((state, step) => typeTamil(state, step(state.text)), start)
const keys = (typed: string) => [...typed].map((c) => (text: string) => text + c)
const backspace = (text: string) => text.slice(0, -1)

describe("toTamil", () => {
  it.each([
    ["thamizh", "தமிழ்"],
    ["vaNakkam", "வணக்கம்"],
    ["nandri", "நன்றி"],
    ["muttai", "முட்டை"],
    ["naattu", "நாட்டு"],
    ["kOzhi", "கோழி"],
    ["kaalai", "காலை"],
    ["maalai", "மாலை"],
    ["sekku", "செக்கு"],
    ["eNNey", "எண்ணெய்"],
    ["manjaL", "மஞ்சள்"],
    ["sangam", "சங்கம்"],
    ["thaengaay", "தேங்காய்"],
    ["paal", "பால்"],
    ["arisi", "அரிசி"],
    ["kaaRRu", "காற்று"],
    ["vetri", "வெற்றி"],
    ["vaNdi", "வண்டி"],
    ["pandhu", "பந்து"],
    ["merri", "மெர்ரி"],
    ["faarms", "ஃபார்ம்ஸ்"],
  ])("%s → %s", (latin, tamil) => {
    expect(toTamil(latin)).toBe(tamil)
  })

  it("reads a capital first letter as small, since phones add one", () => {
    expect(toTamil("Nandri")).toBe("நன்றி")
    expect(toTamil("Thamizh")).toBe("தமிழ்")
  })
})

describe("typeTamil", () => {
  it("changes the word letter by letter", () => {
    expect(edits(keys("th")).text).toBe("த்")
    expect(edits(keys("tha")).text).toBe("த")
    expect(edits(keys("thamizh")).text).toBe("தமிழ்")
  })

  it("starts a new word after a space and leaves numbers alone", () => {
    expect(edits(keys("30 muttai")).text).toBe("30 முட்டை")
    expect(edits(keys("naattu kOzhi")).text).toBe("நாட்டு கோழி")
  })

  it("leaves Tamil from a Tamil keyboard as it is", () => {
    expect(edits(keys("தமிழ்")).text).toBe("தமிழ்")
  })

  it("takes a whole word at once, as a phone keyboard sends it", () => {
    expect(edits([(t) => t + "muttai", (t) => t + " "]).text).toBe("முட்டை ")
  })

  it("takes off one English letter with each Backspace", () => {
    const typed = edits(keys("kaa"))
    expect(typed.text).toBe("கா")
    const once = typeTamil(typed, backspace(typed.text))
    expect(once).toEqual({ text: "க", word: "ka" })
    const twice = typeTamil(once, "")
    expect(twice).toEqual({ text: "க்", word: "k" })
  })

  it("carries on typing after a Backspace", () => {
    expect(edits([...keys("paal"), backspace, ...keys("m")]).text).toBe("பாம்")
  })

  it("does not touch what is already in the box", () => {
    const start = { text: "Merry ", word: "" }
    expect(edits(keys("paal"), start).text).toBe("Merry பால்")
  })

  it("keeps the text when a selection is deleted", () => {
    const typed = edits(keys("muttai "))
    expect(typeTamil(typed, "")).toEqual({ text: "", word: "" })
  })

  it("starts afresh when the caret is moved back and a letter typed", () => {
    expect(typeTamil({ text: "பால்", word: "paal" }, "பk")).toEqual({ text: "பக்", word: "k" })
  })
})
