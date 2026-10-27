"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import type { Map as LeafletMap } from "leaflet"
import { LocateFixed, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { checkMyArea, mapStart, searchPlaces, type AreaAnswer } from "@/app/actions/shop"
import type { LatLng, LocationSource } from "@/domain/delivery-area"
import { WheelMark } from "@/components/art/wheel-mark"

const TILES = process.env.NEXT_PUBLIC_MAP_TILES_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

/**
 * Choose the delivery spot on a map (OpenStreetMap). The pin stays in the middle and the map moves under it,
 * which is easier with a thumb than dragging a small marker. Search a place, or jump to where the phone is.
 * Each time the map settles, the server names the place there and compares its PIN with the one typed.
 */
export function LocationPicker({
  pincode,
  initial,
  onPick,
  onClose,
}: {
  pincode: string
  initial: LatLng | null
  onPick: (spot: LatLng, source: LocationSource) => void
  onClose: () => void
}) {
  const t = useTranslations("shop.area")
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const [centre, setCentre] = useState<LatLng | null>(initial)
  const [source, setSource] = useState<LocationSource>("map")
  const [ready, setReady] = useState(false)
  // The answer remembers which spot it was for; while the pin is somewhere else, it is "checking".
  const [answer, setAnswer] = useState<(AreaAnswer & { for: string }) | null>(null)
  const spotKey = centre ? `${centre.lat},${centre.lng}` : ""
  const checking = !!centre && answer?.for !== spotKey
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[] | null>(null)
  const [searching, startSearch] = useTransition()
  const [locError, setLocError] = useState<string | null>(null)

  // Build the map once: start at the spot already chosen, else the PIN's area, else roughly the farm's area.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = await import("leaflet")
      const start = initial ? { ...initial, zoom: 17 } : await mapStart(pincode)
      if (cancelled || !box.current || map.current) return
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], start.zoom)
      L.tileLayer(TILES, { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(m)
      m.on("dragstart", () => setSource("map"))
      m.on("moveend", () => {
        const c = m.getCenter()
        setCentre({ lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6 })
      })
      map.current = m
      setReady(true)
      const c = m.getCenter()
      setCentre({ lat: c.lat, lng: c.lng })
    })()
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
    }
    // The map is built once per opening; later changes move it rather than rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Name the place under the pin once the map has stopped for a moment (the lookup service allows 1 a second).
  useEffect(() => {
    if (!centre) return
    const key = `${centre.lat},${centre.lng}`
    const timer = setTimeout(async () => {
      const r = await checkMyArea({ pincode, lat: centre.lat, lng: centre.lng })
      setAnswer({ ...r, for: key })
    }, 900)
    return () => clearTimeout(timer)
  }, [centre, pincode])

  // Escape closes, like any dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // The picker opens from inside the checkout form, so it has no <form> of its own: Enter searches, never submits the order.
  const search = () => {
    if (query.trim().length < 3) return
    startSearch(async () => setResults(await searchPlaces({ query, near: centre ?? undefined })))
  }

  const goTo = (p: LatLng, how: LocationSource) => {
    map.current?.setView([p.lat, p.lng], 17)
    setSource(how)
    setResults(null)
  }

  const locate = () => {
    setLocError(null)
    if (!window.isSecureContext || !("geolocation" in navigator)) return setLocError(t("locationUnavailable"))
    navigator.geolocation.getCurrentPosition(
      (pos) => goTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "gps"),
      (err) => setLocError(err.code === err.PERMISSION_DENIED ? t("locationDenied") : t("locationUnavailable")),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-foreground/40 md:items-center md:p-6" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="flex h-full w-full flex-col overflow-hidden bg-background md:h-[85vh] md:max-w-3xl md:rounded-3xl md:border md:shadow-2xl">
        <header className="flex items-center gap-3 border-b px-4 py-3">
          <h2 id="picker-title" className="flex-1 text-lg font-bold">
            {t("mapTitle")}
          </h2>
          <Button type="button" variant="ghost" size="icon" aria-label={t("close")} onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="flex flex-col gap-2 border-b px-4 py-3" role="search">
          <label htmlFor="place-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <div className="flex gap-2">
            <input
              id="place-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return
                e.preventDefault()
                search()
              }}
              enterKeyHint="search"
              placeholder={t("searchPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-card px-3"
              autoComplete="off"
            />
            <Button type="button" variant="outline" className="h-11" disabled={searching} onClick={search}>
              <Search /> <span className="max-xs:sr-only">{t("search")}</span>
            </Button>
          </div>
          {results && (
            <ul className="max-h-48 overflow-y-auto rounded-xl border bg-card">
              {results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{t("noResults")}</li>}
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button type="button" className="w-full px-3 py-2.5 text-left text-sm" onClick={() => goTo(r, "map")}>
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={box} className="absolute inset-0 bg-muted" aria-label={t("mapHint")} />
          {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t("mapLoading")}</p>}
          {/* The pin: fixed in the middle, its tip on the spot. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full" aria-hidden>
            <svg viewBox="0 0 40 52" className="h-13 w-10 drop-shadow-md">
              <path d="M20 51C20 51 3 31 3 19A17 17 0 0 1 37 19C37 31 20 51 20 51Z" fill="#1E6B45" stroke="#FFF1C7" strokeWidth="2" />
            </svg>
            <WheelMark className="absolute left-1/2 top-[7px] size-6 -translate-x-1/2 text-[#FFF1C7]" />
          </div>
          <Button type="button" variant="outline" className="absolute right-3 bottom-3 z-[500] shadow-md" onClick={locate}>
            <LocateFixed /> {t("useHere")}
          </Button>
        </div>

        <footer className="flex flex-col gap-2 border-t bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <p className="text-sm text-muted-foreground">{t("mapHint")}</p>
          <p className="min-h-6 font-medium" aria-live="polite">
            {!centre ? "" : checking ? t("checking") : answer?.place ? t("near", { place: answer.place }) : t("placeUnknown")}
          </p>
          {answer?.result === "outside" && !checking && <p className="text-sm font-medium text-destructive">{t("outside")}</p>}
          {locError && <p className="text-sm text-muted-foreground">{locError}</p>}
          <Button type="button" size="lg" className="h-12 text-base" disabled={!centre} onClick={() => centre && onPick(centre, source)}>
            {t("deliverHere")}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
