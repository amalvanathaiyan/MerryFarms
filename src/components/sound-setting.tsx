"use client"

import { useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Volume2 } from "lucide-react"
import { SOUND_KEY } from "@/lib/opening"

const CHANGED = "ffy-sound-change"
const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener("storage", onChange)
  }
}
const isOn = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off"
  } catch {
    return true
  }
}

/** The opening's sound, on or off on this phone (also on the opening's own button). On unless turned off. */
export function SoundSetting() {
  const t = useTranslations("sound")
  const on = useSyncExternalStore(subscribe, isOn, () => true)
  const set = (value: boolean) => {
    try {
      localStorage.setItem(SOUND_KEY, value ? "on" : "off")
    } catch {
      // Blocked storage: nothing to keep; the opening plays its default.
    }
    window.dispatchEvent(new Event(CHANGED))
  }
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border bg-card p-4">
      <span className="flex min-w-0 gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-primary">
          <Volume2 className="size-6" aria-hidden />
        </span>
        <span>
          <span className="block text-lg leading-tight font-bold">{t("title")}</span>
          <span className="block text-sm text-muted-foreground">{t("hint")}</span>
          <span className="block text-xs text-muted-foreground">{t("thisPhone")}</span>
        </span>
      </span>
      <input type="checkbox" role="switch" aria-checked={on} checked={on} onChange={(e) => set(e.target.checked)} className="mt-1 size-7 shrink-0 accent-[hsl(var(--primary))]" />
    </label>
  )
}
