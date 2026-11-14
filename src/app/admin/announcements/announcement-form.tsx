"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Megaphone, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { endAnnouncementAction, saveAnnouncementAction } from "@/app/actions/platform-billing"

export type AnnouncementDraft = {
  titleTa: string
  titleEn: string
  bodyTa: string
  bodyEn: string
  tone: "info" | "important"
  audience: "owners" | "everyone"
  onlyFarms: string[]
  startsOn: string
  endsOn: string
}

const chip = (on: boolean) => cn("min-h-11 rounded-xl border px-3 text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")
const area = "rounded-xl border bg-background px-3 py-2 text-base"

/**
 * One announcement: what it says (Tamil and English), how loud (normal or important), who sees it (owners or all
 * staff; every farm or chosen ones) and between which dates.
 */
export function AnnouncementForm({ id, initial, farms, today }: { id: string | null; initial: AnnouncementDraft; farms: { id: string; name: string }[]; today: string }) {
  const t = useTranslations("admin.announcements")
  const te = useTranslations("errors")
  const router = useRouter()
  const [a, setA] = useState(initial)
  const [some, setSome] = useState(initial.onlyFarms.length > 0)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof AnnouncementDraft>(k: K, v: AnnouncementDraft[K]) => setA((x) => ({ ...x, [k]: v }))
  const ready = a.titleTa.trim() && a.titleEn.trim() && a.startsOn && (!some || a.onlyFarms.length > 0)

  const save = () =>
    start(async () => {
      setError(null)
      const r = await saveAnnouncementAction(id, { ...a, bodyTa: a.bodyTa.trim() || null, bodyEn: a.bodyEn.trim() || null, onlyFarms: some ? a.onlyFarms : [], endsOn: a.endsOn || null })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      router.push("/admin/announcements")
    })

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(["Ta", "En"] as const).map((l) => (
          <fieldset key={l} className="flex flex-col gap-3" lang={l === "Ta" ? "ta" : "en"}>
            <legend className="mb-1 font-semibold">{t(`in${l}`)}</legend>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("heading")}</span>
              <Input value={a[`title${l}`]} maxLength={120} required onChange={(e) => set(`title${l}`, e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("message")}</span>
              <textarea rows={3} maxLength={600} value={a[`body${l}`]} onChange={(e) => set(`body${l}`, e.target.value)} className={area} />
            </label>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("toneLabel")}</span>
        <div className="flex flex-wrap gap-2">
          {(["info", "important"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={a.tone === v} className={chip(a.tone === v)} onClick={() => set("tone", v)}>
              {t(`tone_${v}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("whoLabel")}</span>
        <div className="flex flex-wrap gap-2">
          {(["owners", "everyone"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={a.audience === v} className={chip(a.audience === v)} onClick={() => set("audience", v)}>
              {t(`audience_${v}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!some} className={chip(!some)} onClick={() => setSome(false)}>
            {t("allFarms")}
          </button>
          <button type="button" aria-pressed={some} className={chip(some)} onClick={() => setSome(true)}>
            {t("chosenFarms")}
          </button>
        </div>
        {some && (
          <div className="flex flex-wrap gap-2 rounded-xl bg-muted/60 p-2">
            {farms.map((f) => {
              const on = a.onlyFarms.includes(f.id)
              return (
                <button key={f.id} type="button" aria-pressed={on} className={chip(on)} onClick={() => set("onlyFarms", on ? a.onlyFarms.filter((x) => x !== f.id) : [...a.onlyFarms, f.id])}>
                  {f.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("startsOn")}</span>
          <Input type="date" value={a.startsOn} min={id ? undefined : today} required onChange={(e) => set("startsOn", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("endsOn")}</span>
          <Input type="date" value={a.endsOn} min={a.startsOn || today} onChange={(e) => set("endsOn", e.target.value)} />
          <span className="text-xs text-muted-foreground">{t("endsOnHint")}</span>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={pending || !ready} className="h-12 self-end text-base">
        <Megaphone /> {id ? t("save") : t("publish")}
      </Button>
    </form>
  )
}

/** Stop: one showing ends today; one not started yet is removed. */
export function StopAnnouncement({ id, coming }: { id: string; coming: boolean }) {
  const t = useTranslations("admin.announcements")
  const te = useTranslations("errors")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          confirm(coming ? t("removeSure") : t("stopSure")) &&
          start(async () => {
            const r = await endAnnouncementAction(id)
            if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
            router.refresh()
          })
        }
      >
        <Square /> {coming ? t("remove") : t("stop")}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </>
  )
}
