"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { ArrowDown, ArrowUp, Clapperboard, Link2, Trash2, Upload, X } from "lucide-react"
import { addYoutubeAction, deleteVideoAction, finishVideoUploadAction, moveVideoAction, startVideoUploadAction, updateVideoAction } from "@/app/actions/videos"
import { useCheer } from "@/components/cheer"
import { MAX_VIDEOS } from "@/domain/videos"
import { prepareVideo, uploadTo, type PreparedVideo } from "@/lib/video-prep"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface VideoItem {
  id: string
  kind: "upload" | "youtube"
  src: string
  posterUrl: string | null
  title: string | null
  banner: boolean
  watch: boolean
  seconds: number | null
}

const mb = (bytes: number) => (Math.round((bytes / 1024 / 1024) * 10) / 10).toString()

/** Settings · Videos (owner): add videos from the phone or YouTube, choose where each shows, order, delete. */
/**
 * `uploads`: "on"; "plan" when the farm's plan doesn't include phone uploads (YouTube still works); "off" when this
 * server has no storage. `space`: bytes the farm's uploads take, and its limit.
 */
export function VideoManager({ videos, uploads, space }: { videos: VideoItem[]; uploads: "on" | "plan" | "off"; space: { used: number; total: number } }) {
  const t = useTranslations("farm.videos")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const errorText = (code: string) => (te.has(code) ? te(code) : te("generic"))

  // Phone upload: choose → make smaller → check and name it → send.
  const [stage, setStage] = useState<"idle" | "shrinking" | "ready" | "sending">("idle")
  const [pct, setPct] = useState(0)
  const [prepared, setPrepared] = useState<PreparedVideo | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [opts, setOpts] = useState({ title: "", banner: false, watch: true })
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  const reset = () => {
    setStage("idle")
    setPrepared(null)
    setPreview(null)
    setPct(0)
    setOpts({ title: "", banner: false, watch: true })
  }

  const choose = async (file: File) => {
    setError(null)
    setStage("shrinking")
    setPct(0)
    try {
      const p = await prepareVideo(file, (s) => setPct(Math.round(s * 100)))
      setPrepared(p)
      setPreview(URL.createObjectURL(p.blob))
      setStage("ready")
    } catch (e) {
      setError(errorText((e as Error).message))
      setStage("idle")
    }
  }

  const send = () =>
    start(async () => {
      if (!prepared) return
      setError(null)
      setStage("sending")
      const begun = await startVideoUploadAction({ type: prepared.type, bytes: prepared.blob.size, shrunk: prepared.shrunk })
      if (!begun.ok) return (setError(errorText(begun.error)), setStage("ready"))
      try {
        await uploadTo(begun.video, prepared.blob, prepared.type)
        if (prepared.poster) await uploadTo(begun.poster, prepared.poster, "image/jpeg").catch(() => {})
      } catch {
        setError(errorText("video_not_uploaded"))
        return setStage("ready")
      }
      const done = await finishVideoUploadAction({
        id: begun.id,
        type: prepared.type,
        seconds: prepared.seconds,
        title: opts.title || undefined,
        banner: opts.banner,
        watch: opts.watch,
        withPoster: !!prepared.poster,
      })
      if (!done.ok) return (setError(errorText(done.error)), setStage("ready"))
      cheer("video")
      reset()
    })

  // YouTube link.
  const [yt, setYt] = useState({ link: "", title: "" })
  const full = videos.length >= MAX_VIDEOS
  const spaceFull = space.used >= space.total
  const usedPct = Math.min(100, Math.round((space.used / space.total) * 100))
  // Known before sending: the shrunk video won't fit in what's left.
  const tooBigForSpace = !!prepared && space.used + prepared.blob.size > space.total

  const change = (id: string, data: Parameters<typeof updateVideoAction>[1]) =>
    start(async () => {
      const r = await updateVideoAction(id, data)
      if (!r.ok) setError(errorText(r.error))
      else cheer("settings")
    })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t("intro")}</p>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {/* From the phone. */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-primary">
            <Upload className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold">{t("addTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("addHint")}</p>
          </div>
        </div>
        {uploads === "on" && (
          <div className="flex flex-col gap-1" role="group" aria-label={t("spaceTitle")}>
            <p className="text-sm font-semibold">{t("space", { used: mb(space.used), total: mb(space.total) })}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", usedPct >= 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${usedPct}%` }} />
            </div>
          </div>
        )}
        {uploads === "plan" ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">{t("uploadsPlan")}</p>
        ) : uploads === "off" ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">{te("media_off")}</p>
        ) : stage === "idle" ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="video/*"
              className="sr-only"
              aria-label={t("choose")}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) void choose(f)
              }}
            />
            <Button size="lg" className="self-start" disabled={full || spaceFull} onClick={() => fileInput.current?.click()}>
              <Clapperboard /> {t("choose")}
            </Button>
            {full && <p className="text-sm text-muted-foreground">{t("limit", { max: MAX_VIDEOS })}</p>}
            {!full && spaceFull && <p className="text-sm text-muted-foreground">{t("spaceFull")}</p>}
          </>
        ) : stage === "shrinking" ? (
          <div className="flex flex-col gap-2" role="status">
            <p className="font-semibold">{t("shrinking", { pct })}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ) : (
          prepared && (
            <div className="flex flex-col gap-3">
              <video src={preview ?? undefined} controls playsInline className="aspect-video w-full rounded-xl bg-black" />
              <p className="text-sm text-muted-foreground">{t("about", { size: mb(prepared.blob.size), seconds: Math.round(prepared.seconds ?? 0) })}</p>
              {tooBigForSpace && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{te("video_space")}</p>}
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {t("titleLabel")}
                <Input value={opts.title} maxLength={80} placeholder={t("titlePlaceholder")} onChange={(e) => setOpts({ ...opts, title: e.target.value })} className="h-11 font-normal" />
              </label>
              <Choice checked={opts.banner} onChange={(banner) => setOpts({ ...opts, banner })} title={t("asBanner")} hint={t("asBannerHint")} />
              <Choice checked={opts.watch} onChange={(watch) => setOpts({ ...opts, watch })} title={t("asWatch")} hint={t("asWatchHint")} />
              <div className="flex flex-wrap gap-2">
                <Button size="lg" disabled={pending || stage === "sending" || tooBigForSpace || (!opts.banner && !opts.watch)} onClick={send}>
                  <Upload /> {stage === "sending" ? t("uploading") : t("send")}
                </Button>
                <Button size="lg" variant="ghost" disabled={stage === "sending"} onClick={reset}>
                  <X /> {t("cancel")}
                </Button>
              </div>
            </div>
          )
        )}
      </section>

      {/* From YouTube. */}
      <form
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            setError(null)
            const r = await addYoutubeAction({ link: yt.link, title: yt.title || undefined })
            if (!r.ok) return setError(errorText(r.error))
            setYt({ link: "", title: "" })
            cheer("video")
          })
        }}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-primary">
            <Link2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold">{t("youtubeTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("youtubeHint")}</p>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("youtubeLink")}
          <Input required inputMode="url" value={yt.link} placeholder="https://youtu.be/…" onChange={(e) => setYt({ ...yt, link: e.target.value })} className="h-11 font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("titleLabel")}
          <Input value={yt.title} maxLength={80} onChange={(e) => setYt({ ...yt, title: e.target.value })} className="h-11 font-normal" />
        </label>
        <Button type="submit" size="lg" variant="outline" className="self-start" disabled={pending || full || !yt.link.trim()}>
          <Link2 /> {t("add")}
        </Button>
      </form>

      {/* The farm's videos. */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-bold">{t("listTitle")}</h2>
        {videos.length === 0 && <p className="text-muted-foreground">{t("empty")}</p>}
        <ul className="flex flex-col gap-3">
          {videos.map((v, i) => (
            <li key={v.id} className="flex flex-col gap-2 rounded-xl border p-2.5">
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small preview picture from storage or YouTube */}
                <img src={v.posterUrl ?? ""} alt="" className="aspect-video w-28 shrink-0 rounded-lg bg-muted object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="leading-tight font-bold break-words">{v.title || t("untitled", { n: i + 1 })}</p>
                  <p className="text-sm text-muted-foreground">
                    {v.kind === "youtube" ? t("youtube") : t("fromPhone")}
                    {v.seconds ? ` · ${v.seconds}s` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Toggle on={v.banner} disabled={pending || v.kind !== "upload"} title={v.kind !== "upload" ? t("bannerYoutube") : undefined} label={t("asBanner")} onChange={(banner) => change(v.id, { banner })} />
                <Toggle on={v.watch} disabled={pending} label={t("asWatch")} onChange={(watch) => change(v.id, { watch })} />
                <span className="ml-auto flex gap-1">
                  <IconButton label={t("moveUp")} disabled={pending || i === 0} onClick={() => start(async () => void (await moveVideoAction(v.id, "up")))}>
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton label={t("moveDown")} disabled={pending || i === videos.length - 1} onClick={() => start(async () => void (await moveVideoAction(v.id, "down")))}>
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label={t("delete")}
                    disabled={pending}
                    danger
                    onClick={() =>
                      window.confirm(t("deleteConfirm")) &&
                      start(async () => {
                        const r = await deleteVideoAction(v.id)
                        if (!r.ok) setError(errorText(r.error))
                        else cheer("deleted")
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Choice({ checked, onChange, title, hint }: { checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-primary" />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}

function Toggle({ on, label, onChange, disabled, title }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!on)}
      className={cn("min-h-9 rounded-full border px-3 text-sm font-semibold disabled:opacity-50", on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={cn("grid size-9 place-items-center rounded-lg border disabled:opacity-30", danger ? "text-destructive" : "text-muted-foreground")}>
      {children}
    </button>
  )
}
