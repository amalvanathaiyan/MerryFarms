"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Download, Share, SquarePlus, X } from "lucide-react"

/** Chrome and Edge's "this can be installed" event (not in TypeScript's DOM types). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
type Holder = { event: InstallEvent | null; installed: boolean; dismissed?: boolean }

const READY = "ffy-install-ready"
const DISMISSED = "ffy-install-dismissed"

const holder = (): Holder => {
  const w = window as unknown as { __ffyInstall?: Holder }
  w.__ffyInstall ??= { event: null, installed: false }
  return w.__ffyInstall
}

/**
 * Mounted once in the farm app: the browser offers installing only once, as a page loads, so this keeps that offer
 * for any page that shows an install button later.
 */
export function InstallCatcher() {
  useEffect(() => {
    const onOffer = (e: Event) => {
      e.preventDefault()
      holder().event = e as InstallEvent
      window.dispatchEvent(new Event(READY))
    }
    const onInstalled = () => {
      holder().installed = true
      holder().event = null
      window.dispatchEvent(new Event(READY))
    }
    window.addEventListener("beforeinstallprompt", onOffer)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onOffer)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])
  return null
}

type Mode = "hidden" | "button" | "ios" | "menu"

/** Re-read when the browser offers or finishes installing, or the card is closed (here or in another tab). */
const subscribe = (onChange: () => void) => {
  window.addEventListener(READY, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(READY, onChange)
    window.removeEventListener("storage", onChange)
  }
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1"
  } catch {
    // Private mode or blocked storage: the banner shows, and closing it lasts for this page only.
    return holder().dismissed === true
  }
}

function currentMode(): Mode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  if (standalone || holder().installed) return "hidden"
  if (holder().event) return "button"
  // iPhone and iPad (also iPadOS, which reports itself as a Mac with touch): Safari has no install button.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return ios ? "ios" : "menu"
}

/**
 * "Install the app": puts the farm app on the phone's home screen or the computer's desktop, so nobody needs the
 * link again. One tap where the browser allows it; picture steps on iPhone. Hidden once installed.
 *   banner: a card on Today, until installed or closed;
 *   panel:  always on More (with a hint for browsers that install from their own menu).
 */
export function InstallApp({ variant }: { variant: "banner" | "panel" }) {
  const t = useTranslations("farm.install")
  // The server can't know; "hidden" until the browser says, so nothing flashes.
  const mode = useSyncExternalStore(subscribe, currentMode, () => "hidden" as Mode)
  const closed = useSyncExternalStore(subscribe, () => variant === "banner" && wasDismissed(), () => true)

  if (mode === "hidden" || closed) return null
  if (variant === "banner" && mode === "menu") return null

  const close = () => {
    holder().dismissed = true
    try {
      localStorage.setItem(DISMISSED, "1")
    } catch {
      // Kept in memory for this page instead.
    }
    window.dispatchEvent(new Event(READY))
  }

  return (
    <section className="relative flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-accent p-4">
      {variant === "banner" && (
        <button type="button" onClick={close} aria-label={t("close")} className="absolute top-2 right-2 grid size-10 place-items-center rounded-full text-muted-foreground hover:bg-card">
          <X className="size-5" aria-hidden />
        </button>
      )}
      <div className="flex items-start gap-3 pr-8">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Download className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </div>

      {mode === "button" && (
        <button
          type="button"
          onClick={async () => {
            const e = holder().event
            if (!e) return
            await e.prompt()
            const { outcome } = await e.userChoice
            if (outcome === "accepted") holder().installed = true
            holder().event = null
            window.dispatchEvent(new Event(READY))
          }}
          className="flex h-13 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground"
        >
          <Download className="size-5" aria-hidden /> {t("button")}
        </button>
      )}

      {mode === "ios" && (
        <ol className="flex flex-col gap-2 text-base">
          <li className="flex items-center gap-2 rounded-xl bg-card p-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">1</span>
            <span>{t.rich("iosStep1", { icon: () => <Share className="inline size-5 text-primary" aria-label={t("shareIcon")} /> })}</span>
          </li>
          <li className="flex items-center gap-2 rounded-xl bg-card p-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">2</span>
            <span>{t.rich("iosStep2", { icon: () => <SquarePlus className="inline size-5 text-primary" aria-hidden /> })}</span>
          </li>
        </ol>
      )}

      {mode === "menu" && <p className="text-sm">{t("menuHint")}</p>}
    </section>
  )
}
