import { describe, expect, it } from "vitest"
import en from "../../messages/en.json"
import ta from "../../messages/ta.json"
import { CHEER_KINDS, chooseLine, dayCheer, MILESTONES, pickLine, type CheerKind } from "./cheers"

const KINDS = Object.keys(CHEER_KINDS) as CheerKind[]
const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort()

describe("picking a fresh line", () => {
  it("never repeats one of the last few lines of a kind", () => {
    const recent: number[] = []
    for (let n = 0; n < 200; n++) {
      const i = pickLine(6, recent, Math.random())
      expect(recent.slice(-3)).not.toContain(i)
      recent.push(i)
    }
  })

  it("still picks when the pool is tiny", () => {
    expect(pickLine(1, [0, 0], 0.9)).toBe(0)
    expect(pickLine(2, [0], 0.99)).toBe(1)
  })
})

describe("which line goes under the fact", () => {
  const base = { kindSize: 5, recent: [], timeSize: 2, part: "morning" as const, milestoneSize: 3, countToday: 3 }

  it("celebrates milestones, but never on a gentle notice like a bird loss", () => {
    expect(chooseLine({ ...base, kind: "eggs", countToday: 10, rand: seq(0.5) }).pool).toBe("milestone")
    expect(chooseLine({ ...base, kind: "expense", countToday: 5, rand: seq(0.5) }).pool).toBe("milestone")
    expect(chooseLine({ ...base, kind: "loss", countToday: 10, rand: seq(0.5) }).pool).toBe("kind")
    expect(MILESTONES).toContain(10)
  })

  it("now and then says something about the time of day, only on happy notices", () => {
    expect(chooseLine({ ...base, kind: "delivered", rand: seq(0.1, 0.5) })).toEqual({ pool: "time", part: "morning", index: 1 })
    expect(chooseLine({ ...base, kind: "delivered", rand: seq(0.9, 0.5) }).pool).toBe("kind")
    expect(chooseLine({ ...base, kind: "settings", rand: seq(0.1, 0.5) }).pool).toBe("kind")
    expect(chooseLine({ ...base, kind: "cancelled", rand: seq(0.1, 0.5) }).pool).toBe("kind")
  })
})

describe("the words", () => {
  type Cheers = { facts: Record<string, string>; lines: Record<string, string[]>; time: Record<string, string[]>; milestone: string[] }
  const langs = { en: en.cheers as Cheers, ta: ta.cheers as Cheers }

  it("has a fact and several lines for every kind, in English and Tamil", () => {
    for (const [lang, c] of Object.entries(langs)) {
      for (const k of KINDS) {
        expect(c.facts[k], `${lang} fact ${k}`).toBeTruthy()
        expect(c.lines[k]?.length ?? 0, `${lang} lines ${k}`).toBeGreaterThanOrEqual(2)
      }
      for (const part of ["morning", "afternoon", "evening", "night"]) expect(c.time[part]?.length ?? 0).toBeGreaterThanOrEqual(1)
      expect(c.milestone.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("matches English and Tamil line for line, with the same blanks to fill", () => {
    for (const k of KINDS) {
      expect(langs.ta.lines[k].length, k).toBe(langs.en.lines[k].length)
      expect(placeholders(langs.ta.facts[k]), k).toEqual(placeholders(langs.en.facts[k]).filter((p, i, a) => a.indexOf(p) === i))
    }
  })

  it("keeps every line short enough to read at a glance", () => {
    for (const c of Object.values(langs)) {
      for (const lines of [...Object.values(c.lines), ...Object.values(c.time), c.milestone]) for (const l of lines) expect(l.length, l).toBeLessThanOrEqual(90)
    }
  })

  it("never cheers or jokes on a bird loss", () => {
    for (const l of [...langs.en.lines.loss, ...langs.en.lines.cancelled]) expect(l).not.toMatch(/!|great|yay|awesome|hero|nice/i)
  })
})

describe("the notice for a day's entry", () => {
  it("puts a loss first, then eggs, else just saved; several batches are counted", () => {
    expect(dayCheer([{ name: "#2", eggs: 40, lost: 3 }])).toEqual({ kind: "loss", values: { batch: "#2", count: 3 } })
    expect(dayCheer([{ name: "#2", eggs: 40, lost: 0 }])).toEqual({ kind: "eggs", values: { batch: "#2", eggs: 40 } })
    expect(dayCheer([{ name: "#2", eggs: null, lost: 0 }])).toEqual({ kind: "day", values: { batch: "#2" } })
    expect(dayCheer([{ name: "#1", eggs: 10, lost: 0 }, { name: "#2", eggs: null, lost: 0 }])).toEqual({ kind: "allDays", values: { count: 2 } })
    expect(dayCheer([{ name: "#1", eggs: 10, lost: 1 }, { name: "#2", eggs: null, lost: 0 }, { name: "#3", eggs: null, lost: 2 }])).toEqual({ kind: "loss", values: { batch: "#1, #3", count: 3 } })
  })
})
