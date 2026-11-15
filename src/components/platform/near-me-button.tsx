"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Finds farms around where the phone is (the browser asks first). The spot is used for this search only. */
export function NearMeButton({ q }: { q: string }) {
  const t = useTranslations("directory")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12"
        disabled={busy}
        onClick={() => {
          if (!navigator.geolocation) return setError(t("noLocation"))
          setBusy(true)
          setError(null)
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const params = new URLSearchParams({ lat: p.coords.latitude.toFixed(4), lng: p.coords.longitude.toFixed(4) })
              if (q) params.set("q", q)
              router.push(`/farms?${params.toString()}`)
              setBusy(false)
            },
            () => {
              setBusy(false)
              setError(t("noLocation"))
            },
            { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 }
          )
        }}
      >
        <LocateFixed aria-hidden /> {busy ? t("finding") : t("nearMe")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
