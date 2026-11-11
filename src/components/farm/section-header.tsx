import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ChevronLeft } from "lucide-react"
import { SECTION_LOOK, type SectionKey, type Tab } from "@/lib/farm-sections"
import { SectionIcon } from "./section-icon"
import { cn } from "@/lib/utils"

/**
 * Top of every farm page: the section's colour band with its picture, name and one line of help, an optional
 * "back" link, and big tabs (picture + word) when the section has more than one page.
 */
export async function SectionHeader({
  section,
  tabs = [],
  active,
  back,
  title,
  hint,
}: {
  section: SectionKey
  tabs?: Tab[]
  active?: string
  /** Shows "← More" (or the given label) above the band. */
  back?: { href: string; label?: string }
  /** Overrides the section's own title and hint (a single customer, a single batch). */
  title?: string
  hint?: string | null
}) {
  const t = await getTranslations("farm.sections")
  const tt = await getTranslations("farm.tabs")
  const look = SECTION_LOOK[section]
  const tabKey = section === "settings" ? "settings" : section

  return (
    <div className="flex flex-col gap-2.5 print:hidden">
      {back && (
        <Link href={back.href} className="flex h-9 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary underline-offset-4 hover:underline">
          <ChevronLeft className="size-5" aria-hidden /> {back.label ?? t("more.title")}
        </Link>
      )}
      <div className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", look.tint)}>
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", look.strong)}>
          <SectionIcon name={section} className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight font-bold break-words">{title ?? t(`${section}.title`)}</h1>
          {(hint === undefined ? t(`${section}.hint`) : hint) && <p className="text-sm text-muted-foreground">{hint === undefined ? t(`${section}.hint`) : hint}</p>}
        </div>
      </div>
      {/* One row of up to four tabs; more go in rows of three, so no word has to break on a phone. */}
      {tabs.length > 1 && (
        <nav aria-label={t(`${section}.title`)} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length <= 4 ? tabs.length : 3}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const on = tab.key === active
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center text-sm leading-tight font-semibold transition-colors",
                  on ? cn(look.strong, look.border) : "border-border bg-card text-foreground hover:bg-accent"
                )}
              >
                <SectionIcon name={tab.icon ?? tab.key} className={cn("size-6", !on && look.text)} />
                <span className="wrap-anywhere">
                  {tab.label ?? tt(`${tabKey}.${tab.key}`)}
                  {tab.count != null && <span className="tabular-nums"> · {tab.count}</span>}
                </span>
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

/** A big "← back" link for pages one step inside a section (a conversation, a customer). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex h-9 items-center gap-1 self-start rounded-lg pr-2 font-semibold text-primary underline-offset-4 hover:underline print:hidden">
      <ChevronLeft className="size-5" aria-hidden /> {label}
    </Link>
  )
}
