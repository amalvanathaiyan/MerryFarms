"use client"

import { useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Check, LocateFixed, MapPinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { checkMyArea } from "@/app/actions/shop"

export type AreaResult = "inside" | "outside" | "unknown" | "not_set"
type Loc = { lat: number; lng: number } | null

/**
 * PIN code + optional "share my location" for the checkout, with an instant answer
 * to "do you deliver to me?". The server re-checks when the order is placed.
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
  location: Loc
  onLocation: (l: Loc) => void
  onResult: (r: AreaResult) => void
  radiusKm: number | null
}) {
  const t = useTranslations("shop.area")
  const [result, setResult] = useState<AreaResult | null>(null)
  const [locError, setLocError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [, start] = useTransition()

  // Re-check whenever the PIN becomes a full 6 digits or the location changes.
  useEffect(() => {
    const pinReady = /^[1-9]\d{5}$/.test(pincode)
    if (!pinReady && !location) return
    start(async () => {
      const r = await checkMyArea({ pincode: pinReady ? pincode : undefined, lat: location?.lat, lng: location?.lng })
      setResult(r.result)
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
        onLocation({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 })
      },
      (err) => {
        setLocating(false)
        setLocError(err.code === err.PERMISSION_DENIED ? t("locationDenied") : t("locationUnavailable"))
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    )
  }

  return (
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
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={locate} disabled={locating}>
          <LocateFixed /> {location ? t("locationAdded") : locating ? t("locating") : t("shareLocation")}
        </Button>
        {location && (
          <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:underline" onClick={() => onLocation(null)}>
            {t("removeLocation")}
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{radiusKm ? t("weDeliverWithin", { km: radiusKm }) : t("locationHint")}</p>
      {locError && <p className="text-sm text-muted-foreground">{locError}</p>}
      {result === "inside" && (
        <p className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium">
          <Check className="size-4" /> {t("inside")}
        </p>
      )}
      {result === "outside" && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <MapPinOff className="size-4" /> {t("outside")}
        </p>
      )}
    </div>
  )
}
