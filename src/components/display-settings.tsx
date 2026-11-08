"use client"

import { useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Eye, Moon, Smartphone, Sun, Type } from "lucide-react"
import { applyDisplay, DEFAULT_DISPLAY, readDisplay, type Display } from "@/lib/display"
import { cn } from "@/lib/utils"

const CHANGED = "ffy-display-change"
const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener("storage", onChange)
  }
}
// A string snapshot, so React sees the same value until the choice really changes.
const snapshot = () => JSON.stringify(readDisplay())
const serverSnapshot = () => JSON.stringify(DEFAULT_DISPLAY)

/**
 * Display, for eyes that need it: light, dark or like the phone; soft colours; larger text. Kept on this phone,
 * and shown at once.
 */
export function DisplaySettings() {
  const t = useTranslations("display")
  const d: Display = JSON.parse(useSyncExternalStore(subscribe, snapshot, serverSnapshot))
  const set = (patch: Partial<Display>) => {
    applyDisplay({ ...d, ...patch })
    window.dispatchEvent(new Event(CHANGED))
  }

  const themes: { key: Display["theme"]; icon: typeof Sun }[] = [
    { key: "auto", icon: Smartphone },
    { key: "light", icon: Sun },
    { key: "dark", icon: Moon },
  ]

  return (
    <section id="display" className="flex scroll-mt-24 flex-col gap-4 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-primary">
          <Eye className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("colours")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={d.theme === key}
              onClick={() => set({ theme: key })}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-sm font-semibold", d.theme === key ? "border-primary bg-accent text-primary" : "bg-card")}
            >
              <Icon className="size-6" aria-hidden />
              {t(`theme_${key}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border-2 p-3">
        <span className="min-w-0">
          <span className="block font-semibold">{t("soft")}</span>
          <span className="block text-sm text-muted-foreground">{t("softHint")}</span>
        </span>
        <input type="checkbox" role="switch" aria-checked={d.soft} checked={d.soft} onChange={(e) => set({ soft: e.target.checked })} className="mt-1 size-7 shrink-0 accent-[hsl(var(--primary))]" />
      </label>

      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border-2 p-3">
        <span className="flex min-w-0 gap-2">
          <Type className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <span className="block font-semibold">{t("large")}</span>
            <span className="block text-sm text-muted-foreground">{t("largeHint")}</span>
          </span>
        </span>
        <input type="checkbox" role="switch" aria-checked={d.text === "large"} checked={d.text === "large"} onChange={(e) => set({ text: e.target.checked ? "large" : "normal" })} className="mt-1 size-7 shrink-0 accent-[hsl(var(--primary))]" />
      </label>

      <p className="text-xs text-muted-foreground">{t("thisPhone")}</p>
    </section>
  )
}
