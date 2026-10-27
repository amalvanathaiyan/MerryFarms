"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarClock, ClipboardList, MessagesSquare, Package, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/farm", key: "today", icon: Sun },
  { href: "/farm/orders", key: "orders", icon: ClipboardList },
  { href: "/farm/customers", key: "customers", icon: Users },
  { href: "/farm/catalogue", key: "catalogue", icon: Package },
] as const
const SLOTS = { href: "/farm/slots", key: "slots", icon: CalendarClock } as const
const MESSAGES = { href: "/farm/messages", key: "messages", icon: MessagesSquare } as const

export function FarmNav({ toConfirm, unread, messagesOn }: { toConfirm: number; unread: number; messagesOn: boolean }) {
  const t = useTranslations("farm.nav")
  const path = usePathname()
  return (
    // Below 1024px: a 5-tab bar fixed along the bottom. From 1024px: a menu card down the left, sticky under the header.
    // The third tab (customers, "வாடிக்கையாளர்") has the longest label, so its column is wider.
    <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-[1fr_1fr_1.4fr_1fr_1fr] border-t bg-card pb-[env(safe-area-inset-bottom,0px)] print:hidden lg:sticky lg:top-24 lg:mt-6 lg:flex lg:h-fit lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:self-start lg:rounded-3xl lg:border lg:p-2 lg:pb-2">
      {[...ITEMS, messagesOn ? MESSAGES : SLOTS].map(({ href, key, icon: Icon }) => {
        const active = href === "/farm" ? path === "/farm" : path.startsWith(href)
        const badge = key === "messages" ? unread : key === "orders" ? toConfirm : 0
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-center text-tab font-medium sm:text-xs",
              "lg:flex-row lg:gap-3 lg:rounded-2xl lg:px-3 lg:py-2.5 lg:text-left lg:text-base",
              active ? "font-semibold text-primary lg:bg-accent" : "text-muted-foreground lg:hover:bg-accent lg:hover:text-primary"
            )}
          >
            <span className={cn("grid h-8 w-12 shrink-0 place-items-center rounded-full transition-colors lg:size-6", active && "bg-accent lg:bg-transparent")}>
              <Icon className="size-6" />
            </span>
            {/* Under 360px the Tamil labels can't fit five across: icons only, labels kept for screen readers. */}
            <span className="max-w-full whitespace-nowrap max-xs:sr-only">{t(key)}</span>
            {badge > 0 && (
              <span className="absolute left-1/2 top-1 ml-2 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-destructive-foreground tabular-nums lg:static lg:ml-auto">
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
