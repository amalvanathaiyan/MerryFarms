/**
 * Delivery area: a farm delivers within a radius of its location and/or to listed PIN codes.
 * A customer's location (if shared) is checked against the radius; otherwise their PIN code
 * against the list. When neither can decide, the order is "unknown" and staff check it on the call.
 */

export interface LatLng {
  lat: number
  lng: number
}

export interface DeliveryArea {
  farm: LatLng | null
  radiusKm: number | null
  pincodes: string[]
}

export type AreaCheck = { result: "inside" | "outside"; distanceKm: number | null; by: "location" | "pincode" } | { result: "unknown"; distanceKm: null; by: null }

/** Great-circle distance in km (haversine). Good to a few metres at farm-delivery distances. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const isPincode = (v: string) => /^[1-9]\d{5}$/.test(v.trim())

/** Whether the farm has set anything to check against. */
export const areaConfigured = (a: DeliveryArea) => (a.farm !== null && a.radiusKm !== null && a.radiusKm > 0) || a.pincodes.length > 0

/**
 * Checks a customer against the farm's area.
 * - A shared location inside the radius is inside, whatever the PIN.
 * - A listed PIN is inside even if the location is just past the radius (PIN lists are the
 *   farm's deliberate exceptions, e.g. one more village across the road).
 * - Outside only when the evidence says so: location past the radius and PIN not listed,
 *   or no location and a PIN not on a farm that serves by PIN list only.
 */
export function checkArea(area: DeliveryArea, customer: { location?: LatLng | null; pincode?: string | null }): AreaCheck {
  if (!areaConfigured(area)) return { result: "unknown", distanceKm: null, by: null }
  const pin = customer.pincode?.trim() || null
  const pinListed = !!pin && area.pincodes.includes(pin)
  const hasRadius = area.farm !== null && area.radiusKm !== null && area.radiusKm > 0

  if (customer.location && hasRadius) {
    const d = Math.round(distanceKm(area.farm!, customer.location) * 10) / 10
    if (d <= area.radiusKm!) return { result: "inside", distanceKm: d, by: "location" }
    if (pinListed) return { result: "inside", distanceKm: d, by: "pincode" }
    return { result: "outside", distanceKm: d, by: "location" }
  }
  if (pinListed) return { result: "inside", distanceKm: null, by: "pincode" }
  // A farm that serves by PIN list only can say no to an unlisted PIN.
  if (pin && !hasRadius && area.pincodes.length > 0) return { result: "outside", distanceKm: null, by: "pincode" }
  // With a radius but no location, an unlisted PIN proves nothing either way.
  return { result: "unknown", distanceKm: null, by: null }
}

/**
 * Reads a location from what a farmer is likely to paste: a Google Maps link
 * ("…/@13.0827,80.2707,15z", "…?q=13.0827,80.2707", "…!3d13.08!4d80.27") or plain "13.0827, 80.2707".
 */
export function parseLocation(input: string): LatLng | null {
  const s = input.trim()
  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    // WhatsApp and Google Maps shares: "?q=13.08,80.27", "?q=loc:13.08+80.27", "&ll=…", "destination=…"
    /[?&](?:q|query|ll|destination|center)=(?:loc:)?(-?\d{1,3}\.\d+)(?:,|%2C|\+|\s)\s*(-?\d{1,3}\.\d+)/i,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    // OpenStreetMap: "#map=16/13.08/80.27" or "?mlat=13.08&mlon=80.27"
    /#map=\d+\/(-?\d{1,3}\.\d+)\/(-?\d{1,3}\.\d+)/,
    /[?&]mlat=(-?\d{1,3}\.\d+)&mlon=(-?\d{1,3}\.\d+)/,
    // Android "geo:13.08,80.27" and plain "13.0827, 80.2707"
    /^geo:(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/i,
    /^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,
  ]
  for (const p of patterns) {
    const m = s.match(p)
    if (m) {
      const lat = Number(m[1])
      const lng = Number(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  }
  return null
}

/** Short share links ("maps.app.goo.gl/…") hide the coordinates behind a redirect the server follows. */
export function isShortMapsLink(input: string): boolean {
  try {
    const u = new URL(input.trim())
    return u.protocol === "https:" && (u.hostname === "maps.app.goo.gl" || (u.hostname === "goo.gl" && u.pathname.startsWith("/maps")))
  } catch {
    return false
  }
}

/** How a customer gave the delivery spot. "gps" is where their phone was, which is wrong when ordering for someone else. */
export type LocationSource = "gps" | "map" | "link"

/**
 * The PIN code typed vs the PIN code found at the chosen spot.
 * "near": same first three digits (the same sorting district), common at PIN borders and not worth stopping for.
 * "mismatch": a different district: the address and the spot disagree, so the confirmation call checks it.
 * "unknown": no PIN could be found at the spot.
 */
export type PinCheck = "match" | "near" | "mismatch" | "unknown"

export function comparePincodes(typed: string | null | undefined, atSpot: string | null | undefined): PinCheck {
  const a = typed?.trim() ?? ""
  const b = atSpot?.replace(/\s/g, "") ?? ""
  if (!isPincode(a) || !isPincode(b)) return "unknown"
  if (a === b) return "match"
  return a.slice(0, 3) === b.slice(0, 3) ? "near" : "mismatch"
}

/** The parts of an OpenStreetMap (Nominatim) address this app reads. */
export interface GeoAddress {
  house_number?: string
  road?: string
  neighbourhood?: string
  suburb?: string
  hamlet?: string
  village?: string
  town?: string
  city?: string
  city_district?: string
  county?: string
  state_district?: string
  state?: string
  postcode?: string
}

/** "Velachery, Chennai 600042": the locality, the town, and the PIN, short enough for a phone screen. */
export function placeLabel(a: GeoAddress): string {
  const locality = a.suburb ?? a.neighbourhood ?? a.village ?? a.hamlet ?? a.road ?? a.city_district
  const town = a.city ?? a.town ?? a.county ?? a.state_district ?? a.state
  const pin = a.postcode?.replace(/\s/g, "")
  return [[locality, town].filter((v, i, all) => v && all.indexOf(v) === i).join(", "), pin].filter(Boolean).join(" ")
}

/** Directions link for the delivery person (opens Google Maps on any phone). */
export const directionsLink = (p: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`

/** A free map view for checking a pin (OpenStreetMap). */
export const mapViewLink = (p: LatLng) => `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(6)}&mlon=${p.lng.toFixed(6)}#map=15/${p.lat.toFixed(5)}/${p.lng.toFixed(5)}`

/** "600042, 600043" → ["600042", "600043"]; invalid entries returned separately. */
export function parsePincodes(text: string): { valid: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)
  return { valid: [...new Set(parts.filter(isPincode))].sort(), invalid: parts.filter((p) => !isPincode(p)) }
}
