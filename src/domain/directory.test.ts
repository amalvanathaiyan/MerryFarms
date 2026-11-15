import { describe, expect, it } from "vitest"
import { matchesProduct, rankFarms, reachOf } from "./directory"

const farm = { lat: 13.0, lng: 80.0 }
const byRadius = { farm, radiusKm: 10, pincodes: [] as string[] }
const byPin = { farm: null, radiusKm: null, pincodes: ["600001"] }
// About 0.009° of latitude per km.
const north = (km: number) => ({ lat: 13.0 + km * 0.009, lng: 80.0 })

describe("farm directory", () => {
  it("says whether a farm delivers to the customer's spot or PIN", () => {
    expect(reachOf(byRadius, { location: north(5) })).toMatchObject({ reach: "delivers", approx: false })
    expect(reachOf(byRadius, { location: north(20) }).reach).toBe("no")
    expect(reachOf(byPin, { pincode: "600001" }).reach).toBe("delivers")
    expect(reachOf(byPin, { pincode: "600099" }).reach).toBe("no")
    // No area set: the customer asks the farm.
    expect(reachOf({ farm: null, radiusKm: null, pincodes: [] }, { pincode: "600001" }).reach).toBe("ask")
    // A PIN on a farm that serves by distance: from the PIN's centre, with a little slack at the edge.
    expect(reachOf(byRadius, { pincode: "600002", pinCentre: north(4) })).toMatchObject({ reach: "delivers", approx: true })
    expect(reachOf(byRadius, { pincode: "600002", pinCentre: north(11.5) }).reach).toBe("ask")
    expect(reachOf(byRadius, { pincode: "600002", pinCentre: north(30) }).reach).toBe("no")
    expect(reachOf(byRadius, { pincode: "600002" }).reach).toBe("ask")
  })

  it("lists farms that deliver first, nearest first, and leaves out those that don't", () => {
    const f = (name: string, reach: "delivers" | "ask" | "no", d: number | null) => ({ name, reach: { reach, distanceKm: d, approx: false } })
    expect(rankFarms([f("C", "ask", null), f("B", "delivers", 8), f("X", "no", 2), f("A", "delivers", 3)]).map((x) => x.name)).toEqual(["A", "B", "C"])
  })

  it("matches products by any of their names, every word typed", () => {
    expect(matchesProduct("country eggs", ["நாட்டுக் கோழி முட்டை", "Country chicken eggs", "Eggs"])).toBe(true)
    expect(matchesProduct("முட்டை", ["நாட்டுக் கோழி முட்டை", "Country eggs"])).toBe(true)
    expect(matchesProduct("milk", ["Country eggs", null])).toBe(false)
    expect(matchesProduct("  ", ["anything"])).toBe(true)
  })
})
