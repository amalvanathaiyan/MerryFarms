/**
 * Farm For You's farm directory (docs/platform-plan.md §3.4): which farms deliver where the customer is. Pure, so it is
 * tested; src/server/directory.ts loads the farms.
 */
import { areaConfigured, checkArea, distanceKm, type DeliveryArea, type LatLng } from "./delivery-area"

/** `delivers`: inside the farm's area. `ask`: can't tell (no area set, or a PIN near the edge): call the farm.
 *  `no`: outside. `approx`: worked out from the PIN code's centre, not the customer's own spot. */
export type Reach = { reach: "delivers" | "ask" | "no"; distanceKm: number | null; approx: boolean }

/** A PIN area spans a few km: from its centre, only this far past a farm's radius is still "ask", not "no". */
export const PIN_SLACK_KM = 3

export function reachOf(area: DeliveryArea, where: { location?: LatLng | null; pincode?: string | null; pinCentre?: LatLng | null }): Reach {
  if (!areaConfigured(area)) return { reach: "ask", distanceKm: null, approx: false }
  const check = checkArea(area, { location: where.location ?? null, pincode: where.pincode ?? null })
  if (check.result !== "unknown") return { reach: check.result === "inside" ? "delivers" : "no", distanceKm: check.distanceKm, approx: false }
  // A PIN on a farm that serves by distance: judge from the PIN area's centre.
  if (where.pinCentre && area.farm && area.radiusKm) {
    const d = Math.round(distanceKm(area.farm, where.pinCentre) * 10) / 10
    return { reach: d <= area.radiusKm ? "delivers" : d <= area.radiusKm + PIN_SLACK_KM ? "ask" : "no", distanceKm: d, approx: true }
  }
  return { reach: "ask", distanceKm: null, approx: false }
}

/** Farms that deliver first (nearest first), then those to ask; farms that don't deliver there are left out. */
export function rankFarms<T extends { reach: Reach; name: string }>(farms: T[]): T[] {
  const order = { delivers: 0, ask: 1, no: 2 } as const
  return farms
    .filter((f) => f.reach.reach !== "no")
    .sort((a, b) => order[a.reach.reach] - order[b.reach.reach] || (a.reach.distanceKm ?? 1e9) - (b.reach.distanceKm ?? 1e9) || a.name.localeCompare(b.name))
}

/** Does this product match what the customer typed (its names, or its category's)? Case and spacing don't matter. */
export function matchesProduct(q: string, names: (string | null | undefined)[]): boolean {
  const words = q.toLowerCase().normalize("NFC").split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = names.filter(Boolean).join(" ").toLowerCase().normalize("NFC")
  return words.every((w) => text.includes(w))
}
