"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setFarmStory } from "@/app/actions/look"
import { useCheer } from "@/components/cheer"

const area = "min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-base font-normal shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** About the farm (Settings → Look): a few lines in Tamil and English for its page on Farm For You. */
export function StoryForm(props: { storyTa: string | null; storyEn: string | null; profileUrl: string }) {
  const t = useTranslations("farm.story")
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [storyTa, setTa] = useState(props.storyTa ?? "")
  const [storyEn, setEn] = useState(props.storyEn ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await setFarmStory({ storyTa, storyEn })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          cheer("settings")
          router.refresh()
        })
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("tamil")}
        <textarea maxLength={1200} value={storyTa} onChange={(e) => setTa(e.target.value)} placeholder={t("example")} className={area} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("english")}
        <textarea maxLength={1200} value={storyEn} onChange={(e) => setEn(e.target.value)} className={area} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden /> {t("save")}
        </Button>
        <a href={props.profileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline underline-offset-4">
          {t("seePage")}
        </a>
      </div>
    </form>
  )
}
