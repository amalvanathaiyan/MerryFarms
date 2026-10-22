"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { Languages } from "lucide-react"
import { setLocale } from "@/app/actions/locale"
import { LOCALE_LABELS, locales, type Locale } from "@/i18n/routing"
import { cn } from "@/lib/utils"

/**
 * Tamil / English switch, each language in its own script.
 * `compact` (for headers on phones) is one small button naming the language you'd switch TO,
 * so the farm name keeps the room it needs; `icon` is the same as a small round button
 * showing just "EN" or "த" (for the farm banner).
 */
export function LanguageToggle({ className, compact = false, variant }: { className?: string; compact?: boolean; variant?: "icon" }) {
  const current = useLocale() as Locale
  const [pending, start] = useTransition()

  if (variant === "icon") {
    const other = locales.find((l) => l !== current) ?? "ta"
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setLocale(other))}
        lang={other}
        title={LOCALE_LABELS[other]}
        aria-label={`${LOCALE_LABELS[other]} — மொழி / Language`}
        className={cn("grid size-10 shrink-0 place-items-center rounded-full border bg-card text-sm font-bold text-card-foreground", className)}
      >
        {other === "en" ? "EN" : "த"}
      </button>
    )
  }

  if (compact) {
    const other = locales.find((l) => l !== current) ?? "ta"
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => setLocale(other))}
        lang={other}
        aria-label={`${LOCALE_LABELS[other]} — மொழி / Language`}
        className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground", className)}
      >
        <Languages className="size-4" aria-hidden />
        {LOCALE_LABELS[other]}
      </button>
    )
  }

  return (
    <div className={cn("inline-flex rounded-full border bg-card p-0.5 text-sm text-card-foreground", className)} role="group" aria-label="மொழி / Language">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={current === l}
          onClick={() => start(() => setLocale(l))}
          className={cn(
            "rounded-full px-3 py-1 font-medium transition-colors",
            current === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
