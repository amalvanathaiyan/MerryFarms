"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useTranslations } from "next-intl"
import { Pause, Play, PlayCircle, X } from "lucide-react"
import { youtubeEmbed } from "@/domain/videos"
import { cn } from "@/lib/utils"

export interface ShopVideo {
  id: string
  kind: "upload" | "youtube"
  src: string
  posterUrl: string | null
  title: string | null
}

/** Whether moving pictures should start by themselves: not for reduce motion, nor on data saver. */
function mayAutoplay() {
  if (typeof window === "undefined") return false
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return !reduce && !saveData
}

/**
 * The shop's video banner: the farm's banner videos one after another, silent and on repeat. It has a pause button,
 * pauses when scrolled out of sight, and waits for a tap when the phone asks for less motion or less data.
 */
export function FarmVideoBanner({ videos }: { videos: ShopVideo[] }) {
  const t = useTranslations("shop.video")
  const ref = useRef<HTMLVideoElement>(null)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(true)
  const userPaused = useRef(false)

  const v = videos[i % videos.length]

  // Plays by itself while on screen (when the phone allows it); pauses when scrolled away. Runs again for each
  // video in turn, since each is its own element.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!mayAutoplay()) userPaused.current = true
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !userPaused.current) el.play().catch(() => setPaused(true))
      else el.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [v.id])
  const toggle = () => {
    const el = ref.current
    if (!el) return
    if (el.paused) {
      userPaused.current = false
      el.play().catch(() => {})
    } else {
      userPaused.current = true
      el.pause()
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border bg-muted">
      <video
        ref={ref}
        key={v.id}
        src={v.src}
        poster={v.posterUrl ?? undefined}
        muted
        playsInline
        loop={videos.length === 1}
        preload="metadata"
        aria-hidden
        tabIndex={-1}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => setI((n) => (n + 1) % videos.length)}
        className="block aspect-video w-full object-cover"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? t("play") : t("pause")}
        className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/70"
      >
        {paused ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />}
      </button>
    </section>
  )
}

/** "Watch our farm": a button that opens the farm's videos, played with sound, one at a time. */
export function WatchOurFarm({ videos }: { videos: ShopVideo[] }) {
  const t = useTranslations("shop.video")
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)
  const close = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    close.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const v = videos[i]
  return (
    <>
      <button
        type="button"
        onClick={() => (setI(0), setOpen(true))}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-card px-4 text-base font-bold text-primary hover:bg-accent"
      >
        <PlayCircle className="size-6 shrink-0" aria-hidden /> {t("watch")}
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="watch-title" onClick={() => setOpen(false)}>
            <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-t-3xl bg-background p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="watch-title" className="min-w-0 text-xl font-bold break-words">
                  {v.title || t("watch")}
                </h2>
                <button ref={close} type="button" onClick={() => setOpen(false)} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 font-semibold hover:bg-accent">
                  <X className="size-5" aria-hidden /> {t("close")}
                </button>
              </div>
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                {v.kind === "youtube" ? (
                  <iframe
                    key={v.id}
                    src={youtubeEmbed(v.src)}
                    title={v.title || t("watch")}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="size-full border-0"
                  />
                ) : (
                  <video key={v.id} src={v.src} poster={v.posterUrl ?? undefined} controls autoPlay playsInline preload="metadata" className="size-full bg-black object-contain" />
                )}
              </div>
              {videos.length > 1 && (
                <>
                  <h3 className="text-sm font-semibold text-muted-foreground">{t("more")}</h3>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {videos.map((x, n) => (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => setI(n)}
                          aria-current={n === i}
                          className={cn("flex w-full flex-col gap-1 rounded-xl border-2 p-1.5 text-left text-sm", n === i ? "border-primary" : "border-transparent hover:bg-accent")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- small preview picture */}
                          <img src={x.posterUrl ?? ""} alt="" className="aspect-video w-full rounded-lg bg-muted object-cover" />
                          <span className="line-clamp-2 font-semibold">{x.title || t("watch")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
