import "server-only"
import { isPincode, isShortMapsLink, parseLocation, placeLabel, type GeoAddress, type LatLng } from "@/domain/delivery-area"

/**
 * Place lookups for the checkout map, through a Nominatim service (OpenStreetMap's by default; free).
 * Their usage policy: at most one request a second, a real User-Agent with a contact, and caching.
 * Every call here is queued to keep that gap, cached, and gives up after a few seconds; on any failure it
 * returns null and the checkout carries on (the confirmation call checks what couldn't be checked here).
 * NOMINATIM_URL unset → OpenStreetMap's service; set to "" → lookups off.
 */
const BASE = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org"
const USER_AGENT = `FarmForYou/0.1 (farm shop checkout${process.env.GEO_CONTACT_EMAIL ? `; ${process.env.GEO_CONTACT_EMAIL}` : ""})`
const GAP_MS = 1100
const TIMEOUT_MS = 5000

let queue: Promise<unknown> = Promise.resolve()
let last = 0
/** Runs lookups one at a time, at least GAP_MS apart. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    last = Date.now()
    return fn()
  })
  queue = run.catch(() => undefined)
  return run
}

const cache = new Map<string, unknown>()
function remember<T>(key: string, value: T): T {
  if (cache.size > 1000) cache.delete(cache.keys().next().value as string)
  cache.set(key, value)
  return value
}

async function nominatim<T>(path: string, params: Record<string, string>): Promise<T | null> {
  if (!BASE) return null
  const url = `${BASE}${path}?${new URLSearchParams({ format: "jsonv2", ...params })}`
  if (cache.has(url)) return cache.get(url) as T
  try {
    const res = await throttled(() => fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": params["accept-language"] ?? "en" }, signal: AbortSignal.timeout(TIMEOUT_MS) }))
    if (!res.ok) return null
    return remember(url, (await res.json()) as T)
  } catch {
    return null
  }
}

export interface Place {
  /** "Velachery, Chennai 600042" */
  label: string
  pincode: string | null
}

/** What's at a spot: locality, town and PIN. Coordinates are rounded to ~10 m so nearby lookups share the cache. */
export async function placeAt(p: LatLng, lang: "ta" | "en" = "en"): Promise<Place | null> {
  const r = await nominatim<{ address?: GeoAddress }>("/reverse", {
    lat: p.lat.toFixed(4),
    lon: p.lng.toFixed(4),
    zoom: "17",
    addressdetails: "1",
    "accept-language": lang === "ta" ? "ta,en" : "en",
  })
  if (!r?.address) return null
  const pin = r.address.postcode?.replace(/\s/g, "") ?? null
  return { label: placeLabel(r.address), pincode: pin && isPincode(pin) ? pin : null }
}

export interface PlaceMatch extends LatLng {
  label: string
}

/** Places matching a typed name ("Velachery bus stand"), in India, nearest the given point first. */
export async function findPlaces(query: string, near: LatLng | null, lang: "ta" | "en" = "en"): Promise<PlaceMatch[]> {
  const params: Record<string, string> = { q: query, countrycodes: "in", limit: "6", addressdetails: "1", "accept-language": lang === "ta" ? "ta,en" : "en" }
  // A box around the delivery area ranks nearby matches first without excluding others.
  if (near) params.viewbox = [near.lng - 0.4, near.lat + 0.4, near.lng + 0.4, near.lat - 0.4].map((v) => v.toFixed(3)).join(",")
  const rows = await nominatim<{ lat: string; lon: string; name?: string; display_name: string; address?: GeoAddress }[]>("/search", params)
  return (rows ?? []).map((r) => {
    // Lead with the place's own name ("Velachery Railway Station"), then where it is, so similar results can be told apart.
    const area = (r.address && placeLabel(r.address)) || r.display_name.split(",").slice(1, 3).join(",").trim()
    const name = r.name?.trim() || r.display_name.split(",")[0].trim()
    return { lat: Number(r.lat), lng: Number(r.lon), label: name && !area.startsWith(name) ? `${name} · ${area}` : area }
  })
}

/** The middle of a PIN code area, to open the map there. */
export async function pincodeCentre(pincode: string): Promise<LatLng | null> {
  if (!isPincode(pincode)) return null
  const rows = await nominatim<{ lat: string; lon: string }[]>("/search", { postalcode: pincode, countrycodes: "in", limit: "1" })
  return rows?.[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) } : null
}

/**
 * Coordinates from a pasted maps link. Full links are read directly; short share links (maps.app.goo.gl)
 * are followed, at most a few redirects and only to Google Maps hosts, never anywhere the link points.
 */
export async function locationFromLink(input: string): Promise<LatLng | null> {
  const direct = parseLocation(input)
  if (direct) return direct
  if (!isShortMapsLink(input)) return null
  const allowed = new Set(["maps.app.goo.gl", "goo.gl", "maps.google.com", "www.google.com", "google.com", "maps.google.co.in", "www.google.co.in"])
  let url = input.trim()
  for (let hop = 0; hop < 4; hop++) {
    let next: string | null
    try {
      const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      next = res.headers.get("location")
    } catch {
      return null
    }
    if (!next) return null
    const target = new URL(next, url)
    const found = parseLocation(target.toString()) ?? parseLocation(decodeURIComponent(target.toString()))
    if (found) return found
    if (target.protocol !== "https:" || !allowed.has(target.hostname)) return null
    url = target.toString()
  }
  return null
}
