import { describe, expect, it } from "vitest"
import { msToNextPhase, phaseAt, sceneFor } from "./scenes"

/** An instant at this time in India. */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`)

describe("time of day in India", () => {
  it("follows the Tamil Nadu sun", () => {
    expect(phaseAt(ist("2026-11-10", "05:29"))).toBe("night")
    expect(phaseAt(ist("2026-11-10", "05:30"))).toBe("dawn")
    expect(phaseAt(ist("2026-11-10", "07:29"))).toBe("dawn")
    expect(phaseAt(ist("2026-11-10", "07:30"))).toBe("day")
    expect(phaseAt(ist("2026-11-10", "16:59"))).toBe("day")
    expect(phaseAt(ist("2026-11-10", "17:00"))).toBe("evening")
    expect(phaseAt(ist("2026-11-10", "18:44"))).toBe("evening")
    expect(phaseAt(ist("2026-11-10", "18:45"))).toBe("night")
    expect(phaseAt(ist("2026-11-10", "23:59"))).toBe("night")
    expect(phaseAt(ist("2026-11-11", "00:00"))).toBe("night")
  })

  it("knows when the light next changes, and never waits more than an hour", () => {
    expect(msToNextPhase(ist("2026-11-10", "16:30"))).toBe(30 * 60_000)
    expect(msToNextPhase(ist("2026-11-10", "18:00"))).toBe(45 * 60_000)
    expect(msToNextPhase(ist("2026-11-10", "22:00"))).toBe(3_600_000)
    expect(msToNextPhase(ist("2026-11-11", "05:00"))).toBe(30 * 60_000)
  })
})

describe("which picture", () => {
  const heroes = (time: string, days = 6) =>
    Array.from({ length: days }, (_, i) => sceneFor({ farmScenes: true, spot: "hero", at: ist(`2026-11-${String(10 + i).padStart(2, "0")}`, time) }))

  it("keeps the bullock cart for farms without their own pictures", () => {
    expect(sceneFor({ farmScenes: false, spot: "hero", at: ist("2026-11-10", "10:00") })).toBe("cart")
    expect(sceneFor({ farmScenes: false, spot: "small", at: ist("2026-11-10", "21:00") })).toBe("cart")
  })

  it("changes the welcome picture each day: gate, stall and the cart by day", () => {
    const week = heroes("10:00")
    expect(new Set(week)).toEqual(new Set(["gate", "stall", "cart"]))
    for (let i = 1; i < week.length; i++) expect(week[i]).not.toBe(week[i - 1])
  })

  it("keeps the same picture all through the daylight hours of one day", () => {
    expect(heroes("06:00", 6)).toEqual(heroes("16:00", 6))
  })

  it("never shows the daytime cart after dark", () => {
    const nights = [...heroes("19:30", 12), ...heroes("17:30", 12)]
    expect(nights).not.toContain("cart")
    expect(new Set(nights)).toEqual(new Set(["gate", "stall"]))
  })

  it("shows the hen with her eggs in the small spots", () => {
    expect(sceneFor({ farmScenes: true, spot: "small", at: ist("2026-11-10", "10:00") })).toBe("hen")
  })
})
