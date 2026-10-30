"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ImageUp, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { removeFarmLogo, setFarmLogo } from "@/app/actions/look"
import { shrinkPhoto } from "@/lib/shrink-photo"

/** The farm's logo: chosen on the phone, shrunk there (512 px), shown in the shop's banner and on the farm app. */
export function LogoForm({ logoUrl, initials }: { logoUrl: string | null; initials: string }) {
  const t = useTranslations("farm.look")
  const te = useTranslations("errors")
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const pick = (file: File | undefined) => {
    if (!file) return
    setError(null)
    start(async () => {
      let dataUrl: string
      try {
        dataUrl = await shrinkPhoto(file, 512)
      } catch {
        return setError(te("photo_too_big"))
      }
      const r = await setFarmLogo(dataUrl)
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-bold">{t("logoTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("logoHint")}</p>
      <div className="flex flex-wrap items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small logo served by our own route
          <img src={logoUrl} alt={t("logoTitle")} className="size-20 rounded-2xl border bg-card object-contain" />
        ) : (
          <span className="grid size-20 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground" aria-hidden>
            {initials}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
          <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
            <ImageUp /> {pending ? t("uploading") : logoUrl ? t("changeLogo") : t("addLogo")}
          </Button>
          {logoUrl && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await removeFarmLogo()
                  router.refresh()
                })
              }
            >
              <Trash2 /> {t("removeLogo")}
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
