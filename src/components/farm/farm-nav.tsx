"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { menuItemActive, SECTION_LOOK, type MenuItem } from "@/lib/farm-sections"
import { SectionIcon } from "./section-icon"
import { cn } from "@/lib/utils"

/**
 * The main menu: up to five big buttons, each with its own colour, a picture and a word.
 * Below 1024px it is a bar along the bottom; from 1024px a menu card down the left.
 */
export function FarmNav({ items, badges }: { items: MenuItem[]; badges: Partial<Record<MenuItem["key"], number>> }) {
  const t = useTranslations("farm.nav")
  const path = usePathname()
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-10 grid border-t bg-card pb-[env(safe-area-inset-bottom,0px)] print:hidden lg:sticky lg:top-24 lg:mt-6 lg:flex lg:h-fit lg:w-60 lg:shrink-0 lg:flex-col lg:gap-1.5 lg:self-start lg:rounded-3xl lg:border lg:p-2"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = menuItemActive(item, path)
        const look = SECTION_LOOK[item.key]
        const badge = badges[item.key] ?? 0
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-col items-center gap-1 px-0.5 pt-2 pb-2.5 text-center text-xs leading-tight",
              "lg:flex-row lg:gap-3 lg:rounded-2xl lg:px-2.5 lg:py-2 lg:text-left lg:text-base",
              active ? cn("font-bold", look.text, "lg:bg-accent") : "font-medium text-muted-foreground lg:hover:bg-accent"
            )}
          >
            <span className={cn("grid h-9 w-14 shrink-0 place-items-center rounded-full transition-colors lg:size-10", active ? look.strong : cn(look.tint, look.text))}>
              <SectionIcon name={item.key} className="size-6" />
            </span>
            <span className="max-w-full truncate">{t(item.key)}</span>
            {badge > 0 && (
              <span className="absolute top-1 left-1/2 ml-3 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] leading-5 font-bold text-destructive-foreground tabular-nums lg:static lg:ml-auto">
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
