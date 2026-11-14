"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Copy, Download, ExternalLink, Share, SquarePlus, X } from "lucide-react"
import { needsChromeToInstall, openInChromeLink } from "@/domain/install-browser"

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

type Mode = "hidden" | "button" | "ios" | "chrome" | "menu"

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
  // Before the install button: Samsung Internet offers one too, but Play Protect blocks what it installs.
  if (needsChromeToInstall(navigator.userAgent, "brave" in navigator)) return "chrome"
  if (holder().event) return "button"
  // iPhone and iPad (also iPadOS, which reports itself as a Mac with touch): Safari has no install button.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  return ios ? "ios" : "menu"
}

/**
 * "Install the app": puts the farm app on the phone's home screen or the computer's desktop, so nobody needs the
 * link again. One tap where the browser allows it; picture steps on iPhone. Hidden once installed.
 * Other Android browsers are sent to Chrome first: what they install, Play Protect blocks.
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

      {mode === "ios" && <IosSteps />}

      {mode === "chrome" && <OpenInChrome />}

      {mode === "menu" && <p className="text-sm">{t("menuHint")}</p>}
    </section>
  )
}

/** Which iPhone browser this is: Safari and Chrome can add to the home screen; others are sent to Safari. */
function iosBrowser(): "safari" | "chrome" | "other" {
  const ua = navigator.userAgent
  if (/CriOS/.test(ua)) return "chrome"
  if (/FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|GSA\//.test(ua)) return "other"
  return "safari"
}

/**
 * iPhone and iPad: Apple lets only the browser's own menu add a site to the home screen, so this can't be a button.
 * The steps are plain text (not boxes that look tappable), for the browser in use, and a real "Copy the link" helps
 * someone inside WhatsApp's browser (which can't add to the home screen, and can't be told apart from Safari).
 */
function IosSteps() {
  const t = useTranslations("farm.install")
  const browser = useSyncExternalStore(
    () => () => {},
    iosBrowser,
    () => "safari" as const
  )
  const [copied, setCopied] = useState<"yes" | "no" | null>(null)
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/farm`
  const share = () => <Share className="inline size-5 align-text-bottom text-primary" aria-label={t("shareIcon")} />
  const add = () => <SquarePlus className="inline size-5 align-text-bottom text-primary" aria-hidden />
  const steps =
    browser === "chrome"
      ? [t.rich("iosChrome1", { icon: share }), t.rich("iosChrome2", { icon: add }), t("iosAdd")]
      : browser === "other"
        ? [t("iosOther1"), t.rich("iosSafari1", { icon: share }), t.rich("iosSafari2", { icon: add }), t("iosAdd")]
        : [t.rich("iosSafari1", { icon: share }), t.rich("iosSafari2", { icon: add }), t("iosAdd")]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{t("iosIntro")}</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-6 text-base leading-snug marker:font-bold marker:text-primary">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-primary/30 p-3 text-sm">
        <p>{t("iosWhatsapp")}</p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied("yes")
            } catch {
              setCopied("no")
            }
          }}
          className="flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 font-bold text-primary-foreground"
        >
          <Copy className="size-4" aria-hidden /> {copied === "yes" ? t("copied") : t("copyLink")}
        </button>
        {copied === "no" && <p className="font-mono text-sm break-all select-all">{link}</p>}
      </div>
    </div>
  )
}

/**
 * Android browsers other than Chrome: one button that opens this farm app in Chrome, where installing is safe.
 * The menu steps follow, for after Chrome opens.
 */
function OpenInChrome() {
  const t = useTranslations("farm.install")
  const link = typeof window === "undefined" ? "" : openInChromeLink(window.location.host, "/farm")
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base leading-snug">{t("chromeWhy")}</p>
      <a href={link} className="flex h-13 items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-primary-foreground">
        <ExternalLink className="size-5" aria-hidden /> {t("chromeButton")}
      </a>
      <p className="text-sm text-muted-foreground">{t("chromeThen")}</p>
    </div>
  )
}
