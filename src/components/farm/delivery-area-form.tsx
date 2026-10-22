"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { ExternalLink, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveDeliveryArea } from "@/app/actions/billing"
import { mapViewLink, parseLocation, parsePincodes } from "@/domain/delivery-area"

type Loc = { lat: number; lng: number } | null

/** The owner sets where the farm is, how far it delivers, and extra PIN codes it serves. */
export function DeliveryAreaForm({ initial }: { initial: { location: Loc; radiusKm: number | null; pincodes: string[] } }) {
  const t = useTranslations("farm.area")
  const te = useTranslations("errors")
  const [location, setLocation] = useState<Loc>(initial.location)
  const [paste, setPaste] = useState("")
  const [radius, setRadius] = useState(initial.radiusKm ? String(initial.radiusKm) : "")
  const [pins, setPins] = useState(initial.pincodes.join(", "))
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const here = () => {
    setNote(null)
    if (!window.isSecureContext || !("geolocation" in navigator)) return setNote(t("needsHttps"))
    navigator.geolocation.getCurrentPosition(
      (p) => (setSaved(false), setLocation({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 })),
      () => setNote(t("locationDenied")),
      { enableHighAccuracy: true, timeout: 20_000 }
    )
  }

  const usePasted = () => {
    const loc = parseLocation(paste)
    if (!loc) return setNote(t("pasteNotUnderstood"))
    setNote(null)
    setSaved(false)
    setLocation(loc)
    setPaste("")
  }

  const badPins = parsePincodes(pins).invalid

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{t("farmLocation")}</span>
        {location ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="tabular-nums">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
            <a href={mapViewLink(location)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
              {t("viewOnMap")} <ExternalLink className="size-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("notSet")}</p>
        )}
        <Button type="button" variant="outline" onClick={here} className="self-start">
          <LocateFixed /> {t("useHere")}
        </Button>
        <div className="flex gap-2">
          <Input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t("pastePlaceholder")} aria-label={t("pastePlaceholder")} className="h-11" />
          <Button type="button" variant="outline" onClick={usePasted} disabled={!paste.trim()}>
            {t("use")}
          </Button>
        </div>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("radius")}
        <Input type="number" min={0} max={100} step="0.5" inputMode="decimal" value={radius} onChange={(e) => (setSaved(false), setRadius(e.target.value))} className="h-11 w-32 font-normal" />
        <span className="font-normal text-muted-foreground">{t("radiusHint")}</span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("pincodes")}
        <textarea rows={2} value={pins} onChange={(e) => (setSaved(false), setPins(e.target.value))} placeholder="600042, 600043" className="rounded-md border border-input bg-transparent px-3 py-2 font-normal tabular-nums" />
        <span className="font-normal text-muted-foreground">{t("pincodesHint")}</span>
        {badPins.length > 0 && <span className="font-normal text-destructive">{t("badPins", { pins: badPins.join(", ") })}</span>}
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <Button
        disabled={pending || badPins.length > 0}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await saveDeliveryArea({ lat: location?.lat ?? null, lng: location?.lng ?? null, radiusKm: radius ? Number(radius) : null, pincodes: pins })
            if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
            else setSaved(true)
          })
        }
      >
        {saved ? t("saved") : t("save")}
      </Button>
    </section>
  )
}
