"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { Languages } from "lucide-react"
import { setLocale } from "@/app/actions/locale"
import { LOCALE_LABELS, locales, type Locale } from "@/i18n/routing"
import { cn } from "@/lib/utils"

// Hover, press and "switching…" are set here rather than left to the shared rules: the button is disabled
// while the page reloads in the other language, which is exactly when people need to see it reacted.
const STATES =
  "transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-primary hover:bg-accent hover:text-primary hover:shadow-md active:scale-95 disabled:cursor-wait disabled:opacity-60"

/**
 * Tamil / English switch, each language written in full in its own script ("தமிழ்", "English").
 * Default: both side by side, the current one filled. `compact` (headers): on phones, one button naming the
 * language you'd switch TO, so the farm name keeps its room; from tablet width up, both side by side again.
 */
export function LanguageToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const current = useLocale() as Locale
  const [pending, start] = useTransition()

  if (compact) {
    const other = locales.find((l) => l !== current) ?? "ta"
    return (
      <>
        <LanguageToggle className={cn("max-sm:hidden", className)} />
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => setLocale(other))}
          lang={other}
          aria-label={`${LOCALE_LABELS[other]} — மொழி / Language`}
          aria-busy={pending}
          className={cn("inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 text-sm font-medium text-card-foreground sm:hidden", STATES, pending && "animate-pulse", className)}
        >
          <Languages className="size-4 max-xs:hidden" aria-hidden />
          {LOCALE_LABELS[other]}
        </button>
      </>
    )
  }

  return (
    <div className={cn("inline-flex h-10 shrink-0 items-center rounded-full border bg-card p-0.5 text-sm text-card-foreground", className)} role="group" aria-label="மொழி / Language">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={current === l}
          onClick={() => start(() => setLocale(l))}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1.5 font-medium transition-[color,background-color,transform] duration-200 active:scale-95 disabled:cursor-wait",
            current === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-primary",
            pending && current !== l && "animate-pulse"
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  )
}
