"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setFarmBrand } from "@/app/actions/look"
import { FarmName, OnFarmForYou } from "@/components/art/brand-mark"
import { showPlatformLine } from "@/domain/brand"
import { useCheer } from "@/components/cheer"

/**
 * The farm's tagline and name colours (Settings → Look), with a preview of the shop's banner. FarmForYou's small
 * line always shows under the tagline; the farm can't remove it, and it never gets bigger than the farm's words.
 */
export function BrandForm(props: { nameTa: string; nameEn: string; taglineTa: string | null; taglineEn: string | null; nameColours: string[] }) {
  const t = useTranslations("farm.look")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const router = useRouter()
  const [taglineTa, setTaglineTa] = useState(props.taglineTa ?? "")
  const [taglineEn, setTaglineEn] = useState(props.taglineEn ?? "")
  const [coloured, setColoured] = useState(props.nameColours.length > 0)
  const [colours, setColours] = useState<string[]>(props.nameColours.length ? [...props.nameColours, "#1F6B3A"].slice(0, 2) : ["#A8262B", "#1F6B3A"])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const used = coloured ? colours : []
  const save = () =>
    start(async () => {
      setError(null)
      const r = await setFarmBrand({ taglineTa, taglineEn, nameColours: used })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      cheer("settings")
      router.refresh()
    })

  const preview = (name: string, tagline: string, lang: "ta" | "en") => (
    <div lang={lang} className="flex flex-col gap-0.5 rounded-xl bg-background px-3 py-2">
      <FarmName name={name} colours={used} className="font-display text-lg leading-tight font-bold" />
      <span className="flex flex-wrap items-center gap-x-2 text-xs">
        {tagline && (showPlatformLine(tagline) ? <span className="font-medium opacity-90">{tagline}</span> : <span className="font-semibold text-primary uppercase" style={{ letterSpacing: "0.12em" }}>{tagline}</span>)}
        {showPlatformLine(tagline) && <OnFarmForYou />}
      </span>
    </div>
  )

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-bold">{t("brandTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("brandHint")}</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">{t("taglineTa")}</span>
        <Input lang="ta" value={taglineTa} maxLength={60} onChange={(e) => setTaglineTa(e.target.value)} placeholder={t("taglinePlaceholderTa")} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">{t("taglineEn")}</span>
        <Input lang="en" value={taglineEn} maxLength={60} onChange={(e) => setTaglineEn(e.target.value)} placeholder={t("taglinePlaceholderEn")} />
      </label>

      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 accent-primary" checked={coloured} onChange={(e) => setColoured(e.target.checked)} />
        <span className="flex flex-col">
          <span className="font-medium">{t("nameColours")}</span>
          <span className="text-sm text-muted-foreground">{t("nameColoursHint")}</span>
        </span>
      </label>
      {coloured && (
        <div className="flex flex-wrap gap-4">
          {colours.map((c, i) => (
            <label key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={c}
                onChange={(e) => setColours((all) => all.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))}
                className="h-11 w-14 cursor-pointer rounded-lg border bg-card p-1"
              />
              <span className="text-sm">{t(i === 0 ? "colourFirst" : "colourSecond")}</span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-dashed p-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{t("brandPreview")}</span>
        {preview(props.nameTa, taglineTa || taglineEn, "ta")}
        {preview(props.nameEn, taglineEn || taglineTa, "en")}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" onClick={save} disabled={pending} className="self-start">
        <Save /> {t("saveBrand")}
      </Button>
    </section>
  )
}
