/**
 * Farm Core's places and assets (docs/platform-plan.md §3.2), the pure part: the kinds, land sizes in any unit,
 * and when an asset's service is due. Tested; src/server/farm-core.ts loads and saves.
 */
import { addDays, daysBetween } from "./ist"

export const PLACE_KINDS = ["block", "plot", "shed", "pond", "well", "borewell", "store", "other"] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]
/** Land, measured in acres or cents and with a soil. */
export const LAND_KINDS: readonly PlaceKind[] = ["block", "plot"]
/** Has a size (land and ponds). */
export const SIZED_KINDS: readonly PlaceKind[] = ["block", "plot", "pond"]
/** Has a depth. */
export const WATER_KINDS: readonly PlaceKind[] = ["well", "borewell"]

export const AREA_UNITS = ["acre", "cent", "hectare", "sqft"] as const
export type AreaUnit = (typeof AREA_UNITS)[number]
const ACRES_PER: Record<AreaUnit, number> = { acre: 1, cent: 0.01, hectare: 2.4710538, sqft: 1 / 43_560 }

export const SOILS = ["red", "black", "sandy", "clay", "loam", "laterite"] as const

export const ASSET_KINDS = ["motor", "pump", "tractor", "vehicle", "generator", "solar", "sprayer", "tool", "building", "other"] as const
export type AssetKind = (typeof ASSET_KINDS)[number]

export const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v)

/** A size in acres, from any unit. */
export const toAcres = (area: number, unit: string) => area * (ACRES_PER[unit as AreaUnit] ?? 1)

/**
 * The farm's land in acres: every block, plus plots that aren't inside a block (a block's plots are part of it, so
 * they aren't counted twice). Places no longer used don't count.
 */
export function totalLandAcres(places: { id: string; kind: string; parentId: string | null; area: number | null; areaUnit: string; retiredAt: Date | null }[]): number {
  const land = places.filter((p) => !p.retiredAt && isOneOf(LAND_KINDS, p.kind))
  const blocks = new Set(land.filter((p) => p.kind === "block").map((p) => p.id))
  const acres = land.filter((p) => p.kind === "block" || !p.parentId || !blocks.has(p.parentId)).reduce((a, p) => a + (p.area ? toAcres(p.area, p.areaUnit) : 0), 0)
  return Math.round(acres * 100) / 100
}

export type ServiceState = "overdue" | "soon" | "ok"

/**
 * When an asset's next service is due: the set number of days after its last service (or after it was bought, if
 * never serviced). Overdue after that day; soon within a week. Null when it has no regular service.
 */
export function serviceDue(a: { serviceEveryDays: number | null; lastServiceOn: string | null; boughtOn: string | null }, today: string): { on: string; state: ServiceState; days: number } | null {
  if (!a.serviceEveryDays) return null
  const from = a.lastServiceOn ?? a.boughtOn
  if (!from) return { on: today, state: "soon", days: 0 }
  const on = addDays(from, a.serviceEveryDays)
  const days = daysBetween(today, on)
  return { on, state: days < 0 ? "overdue" : days <= 7 ? "soon" : "ok", days }
}
