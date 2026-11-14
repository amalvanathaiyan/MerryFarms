import { afterEach, describe, expect, it, vi } from "vitest"
import { openingParts, openingScript } from "./opening"

describe("opening", () => {
  it("writes a script that runs", () => {
    for (const app of ["shop", "farm", "admin"] as const) expect(() => new Function(openingScript(app, openingParts(app, { hasMark: true })))).not.toThrow()
  })

  it("plays FarmForYou's part, then the farm's, for the shop and the farm app; FarmForYou's alone for admin", () => {
    expect(openingParts("shop", { hasMark: true })).toHaveLength(2)
    expect(openingParts("farm", { hasMark: false })).toHaveLength(2)
    expect(openingParts("admin", { hasMark: true })).toHaveLength(1)
    expect(openingParts("shop", null)).toHaveLength(1)
  })

  it("lasts the same for every farm, with a mark or a logo", () => {
    const length = (hasMark: boolean) => openingParts("shop", { hasMark }).reduce((s, p) => s + p.end, 0)
    expect(length(true)).toBe(length(false))
    for (const p of [...openingParts("shop", { hasMark: true }), ...openingParts("shop", { hasMark: false })]) expect(p.drawn).toBeLessThan(p.end)
  })
})

/** A stand-in page for the <head> script: <html>'s attributes, event listeners, storage and an AudioContext that logs. */
function fakePage(stored: Record<string, string> = {}) {
  const attrs = new Map<string, string>()
  const listeners: Record<string, ((e: { target: unknown }) => void)[]> = {}
  const tones: { f: number; at: number }[] = []
  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    resume() {
      ctx.state = "running"
    },
    suspend() {
      ctx.state = "suspended"
    },
    close() {},
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }),
    createOscillator: () => {
      const o = { type: "", frequency: { setValueAtTime: (f: number, at: number) => tones.push({ f, at }), exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }
      return o
    },
  }
  const store = { ...stored }
  vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("standalone") }), AudioContext: function () { return ctx } })
  vi.stubGlobal("navigator", {})
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem() {} })
  vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) })
  vi.stubGlobal("document", {
    documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k) },
    addEventListener: (type: string, fn: (e: { target: unknown }) => void) => (listeners[type] ??= []).push(fn),
  })
  const el = (sel: string | null) => ({ closest: (q: string) => (q === ".opening" || q === sel ? {} : null) })
  const fire = (type: string, target: unknown) => listeners[type]?.forEach((fn) => fn({ target }))
  return { attrs, tones, store, ctx, animationStarts: () => fire("animationstart", el(null)), tapOpening: () => fire("click", el(null)), tapSound: () => fire("click", el("[data-op-sound]")) }
}

describe("opening script on a page", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("runs FarmForYou's part, then the farm's, then fades, timed from when it starts on screen", () => {
    vi.useFakeTimers()
    const page = fakePage()
    new Function(openingScript("shop", openingParts("shop", { hasMark: true })))()
    expect(page.attrs.get("data-opening")).toBe("shop")
    vi.advanceTimersByTime(5000) // a slow launch: nothing moves until the opening is on screen
    expect(page.attrs.has("data-opening-stage")).toBe(false)
    page.animationStarts()
    vi.advanceTimersByTime(3200)
    expect(page.attrs.get("data-opening-stage")).toBe("2")
    vi.advanceTimersByTime(3200)
    expect(page.attrs.has("data-opening-out")).toBe(true)
    vi.advanceTimersByTime(400)
    expect(page.attrs.has("data-opening")).toBe(false)
  })

  it("plays each part's sounds, and the button turns them off and keeps that", () => {
    vi.useFakeTimers()
    const page = fakePage()
    new Function(openingScript("shop", openingParts("shop", { hasMark: true })))()
    expect(page.attrs.get("data-opening-sound")).toBe("on")
    page.animationStarts()
    const first = page.tones.length
    expect(first).toBeGreaterThan(0)
    page.tapSound()
    expect(page.store["ffy-sound"]).toBe("off")
    expect(page.attrs.get("data-opening-sound")).toBe("off")
    expect(page.attrs.has("data-opening-stage")).toBe(false) // the sound button doesn't skip the opening
    vi.advanceTimersByTime(3200)
    expect(page.tones.length).toBe(first) // the farm's part plays silently
  })

  it("stays silent when sound was turned off", () => {
    vi.useFakeTimers()
    const page = fakePage({ "ffy-sound": "off" })
    new Function(openingScript("farm", openingParts("farm", { hasMark: false })))()
    page.animationStarts()
    vi.advanceTimersByTime(7000)
    expect(page.tones).toHaveLength(0)
    expect(page.attrs.has("data-opening")).toBe(false)
  })

  it("a tap skips only a part's hold, never its animation", () => {
    vi.useFakeTimers()
    const page = fakePage()
    new Function(openingScript("shop", openingParts("shop", { hasMark: true })))()
    page.animationStarts()
    vi.advanceTimersByTime(1000)
    page.tapOpening()
    expect(page.attrs.has("data-opening-stage")).toBe(false)
    vi.advanceTimersByTime(1500)
    page.tapOpening()
    expect(page.attrs.get("data-opening-stage")).toBe("2")
  })
})
