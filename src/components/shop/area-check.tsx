"use client"

import { useEffect, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { AlertTriangle, Check, Link2, LocateFixed, MapPin, MapPinOff, Map as MapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { checkMyArea, readLocationLink, type AreaAnswer } from "@/app/actions/shop"
import type { LatLng, LocationSource } from "@/domain/delivery-area"

// The map (Leaflet) only loads when someone opens it.
const LocationPicker = dynamic(() => import("./location-picker").then((m) => m.LocationPicker), { ssr: false })

export type AreaResult = AreaAnswer["result"]
export type Spot = (LatLng & { source: LocationSource }) | null

/**
 * PIN code and the delivery spot, with an instant answer to "do you deliver here?" and "is this the right spot?".
 * The spot can be chosen on a map, taken from where the phone is, or read from a pasted maps link, so people
 * ordering for someone in another place aren't tied to their own location. The server re-checks on ordering.
 */
export function AreaCheck({
  pincode,
  onPincode,
  location,
  onLocation,
  onResult,
  radiusKm,
}: {
  pincode: string
  onPincode: (v: string) => void
  location: Spot
  onLocation: (l: Spot) => void
  onResult: (r: AreaResult) => void
  radiusKm: number | null
}) {
  const t = useTranslations("shop.area")
  const [answer, setAnswer] = useState<AreaAnswer | null>(null)
  const [locError, setLocError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [picking, setPicking] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState("")
  const [linkError, setLinkError] = useState(false)
  const [readingLink, startLink] = useTransition()
  const [, start] = useTransition()

  // Re-check whenever the PIN becomes a full 6 digits or the spot changes.
  useEffect(() => {
    const pinReady = /^[1-9]\d{5}$/.test(pincode)
    if (!pinReady && !location) return
    start(async () => {
      const r = await checkMyArea({ pincode: pinReady ? pincode : undefined, lat: location?.lat, lng: location?.lng })
      setAnswer(r)
      onResult(r.result)
    })
  }, [pincode, location, onResult])

  const locate = () => {
    setLocError(null)
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setLocError(t("locationUnavailable"))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onLocation({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6, source: "gps" })
      },
      (err) => {
        setLocating(false)
        setLocError(err.code === err.PERMISSION_DENIED ? t("locationDenied") : t("locationUnavailable"))
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  }

  const applyLink = () => {
    setLinkError(false)
    startLink(async () => {
      const spot = await readLocationLink(link)
      if (!spot) return setLinkError(true)
      onLocation({ ...spot, source: "link" })
      setLinkOpen(false)
      setLink("")
    })
  }

  const pinFound = answer?.spotPincode
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor="pincode" className="text-sm font-semibold">
          {t("pincode")}
        </label>
        <input
          id="pincode"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="[1-9][0-9]{5}"
          maxLength={6}
          value={pincode}
          onChange={(e) => onPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-12 w-40 rounded-md border border-input bg-transparent px-3 tabular-nums"
        />
      </div>

      <fieldset className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
        <legend className="px-1 text-sm font-semibold">{t("spotTitle")}</legend>
        {location ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span className="flex flex-col">
                <span className="font-medium">{answer?.place ? t("near", { place: answer.place }) : t(`source_${location.source}`)}</span>
                <span className="text-sm text-muted-foreground">{t(`source_${location.source}`)}</span>
              </span>
            </p>
            {location.source === "gps" && <p className="text-sm text-muted-foreground">{t("gpsNote")}</p>}
            {answer?.pinCheck === "near" && pinFound && <p className="text-sm text-muted-foreground">{t("pinNear", { found: pinFound, typed: pincode })}</p>}
            {answer?.pinCheck === "mismatch" && pinFound && (
              <div role="alert" className="flex flex-col gap-2 rounded-xl bg-yolk p-3 text-yolk-foreground">
                <p className="flex items-start gap-2 text-sm font-medium">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t("pinMismatch", { found: pinFound, typed: pincode })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onPincode(pinFound)}>
                    {t("usePin", { pin: pinFound })}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPicking(true)}>
                    {t("movePin")}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                <MapIcon /> {t("change")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onLocation(null)}>
                {t("removeLocation")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{radiusKm ? t("weDeliverWithin", { km: radiusKm }) : t("spotHint")}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button type="button" variant="outline" className="h-11" onClick={() => setPicking(true)}>
                <MapIcon /> {t("chooseOnMap")}
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={locate} disabled={locating}>
                <LocateFixed /> {locating ? t("locating") : t("useHere")}
              </Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => setLinkOpen((o) => !o)} aria-expanded={linkOpen}>
                <Link2 /> {t("pasteLink")}
              </Button>
            </div>
            {linkOpen && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="spot-link" className="text-sm font-medium">
                  {t("linkLabel")}
                </label>
                <div className="flex gap-2">
                  <input
                    id="spot-link"
                    type="url"
                    inputMode="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    onKeyDown={(e) => {
                      // Inside the checkout form: Enter reads the link instead of placing the order.
                      if (e.key !== "Enter") return
                      e.preventDefault()
                      if (link.trim().length >= 5) applyLink()
                    }}
                    enterKeyHint="go"
                    placeholder={t("linkPlaceholder")}
                    className="h-11 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3"
                  />
                  <Button type="button" className="h-11" disabled={readingLink || link.trim().length < 5} onClick={applyLink}>
                    {readingLink ? t("readingLink") : t("readLink")}
                  </Button>
                </div>
                {linkError && <p className="text-sm text-destructive">{t("linkNotRead")}</p>}
              </div>
            )}
          </div>
        )}
        {locError && <p className="text-sm text-muted-foreground">{locError}</p>}
      </fieldset>

      {answer?.result === "inside" && (
        <p className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium">
          <Check className="size-4" /> {t("inside")}
        </p>
      )}
      {answer?.result === "outside" && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <MapPinOff className="size-4" /> {t("outside")}
        </p>
      )}

      {picking && (
        <LocationPicker
          pincode={pincode}
          initial={location}
          onClose={() => setPicking(false)}
          onPick={(spot, source) => {
            onLocation({ ...spot, source })
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
