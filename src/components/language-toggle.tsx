"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { setLocale } from "@/app/actions/locale"
import { LOCALE_LABELS, locales } from "@/i18n/routing"
import { cn } from "@/lib/utils"

/** Tamil / English switch. Shows each language in its own script. */
export function LanguageToggle({ className }: { className?: string }) {
  const current = useLocale()
  const [pending, start] = useTransition()
  return (
    <div className={cn("inline-flex rounded-full border bg-card p-0.5 text-sm", className)} role="group" aria-label="மொழி / Language">
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
