"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Bell, BellOff, Check, Share } from "lucide-react"
import { Button } from "@/components/ui/button"
import { savePushSubscription } from "@/app/actions/push"

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

type Env = "server" | "ok" | "denied" | "ios_install" | "unsupported"

function detect(): Env {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true
  // iPhones only allow notifications for apps added to the Home Screen.
  if (ios && !standalone) return "ios_install"
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported"
  return Notification.permission === "denied" ? "denied" : "ok"
}
const noSubscribe = () => () => {}

function keyBytes(base64url: string) {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

/**
 * "Get updates on this phone": asks for notification permission and registers the phone.
 * Shows step-by-step help on iPhones (Home Screen needed) and when notifications are blocked.
 */
export function EnablePush({ who }: { who: "customer" | "staff" }) {
  const t = useTranslations("push")
  const env = useSyncExternalStore(noSubscribe, detect, () => "server" as const)
  const [state, setState] = useState<"unknown" | "idle" | "on" | "busy" | "failed" | "denied">("unknown")

  // Already allowed on this phone: re-save it (it may belong to another person on a shared phone).
  useEffect(() => {
    if (env !== "ok" || !KEY) return
    let stop = false
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (stop) return
        if (sub && Notification.permission === "granted") {
          await savePushSubscription({ who, subscription: sub.toJSON() })
          setState("on")
        } else setState("idle")
      })
      .catch(() => !stop && setState("idle"))
    return () => {
      stop = true
    }
  }, [env, who])

  if (!KEY || env === "server" || env === "unsupported") return null

  async function enable() {
    setState("busy")
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied")
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }))
      const r = await savePushSubscription({ who, subscription: sub.toJSON() })
      setState(r.ok ? "on" : "failed")
    } catch {
      setState("failed")
    }
  }

  if (state === "on")
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="size-4 text-primary" /> {t("on")}
      </p>
    )

  const box = "flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm"

  if (env === "ios_install")
    return (
      <div className={box}>
        <p className="flex items-center gap-2 font-semibold">
          <Bell className="size-4" /> {t("title")}
        </p>
        <p className="text-muted-foreground">{t("iosIntro")}</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            {t("iosStep1")} <Share className="inline size-4 align-text-bottom" />
          </li>
          <li>{t("iosStep2")}</li>
          <li>{t("iosStep3")}</li>
        </ol>
      </div>
    )

  if (env === "denied" || state === "denied")
    return (
      <div className={box}>
        <p className="flex items-center gap-2 font-semibold">
          <BellOff className="size-4" /> {t("blocked")}
        </p>
        <p className="text-muted-foreground">{t("blockedHint")}</p>
      </div>
    )

  if (state === "unknown") return null

  return (
    <div className={box}>
      <p className="flex items-center gap-2 font-semibold">
        <Bell className="size-4" /> {t("title")}
      </p>
      <p className="text-muted-foreground">{who === "staff" ? t("hintStaff") : t("hintCustomer")}</p>
      {state === "failed" && <p className="text-destructive">{t("failed")}</p>}
      <Button onClick={enable} disabled={state === "busy"} className="self-start">
        <Bell /> {t("enable")}
      </Button>
    </div>
  )
}
