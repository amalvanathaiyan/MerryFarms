"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CalendarClock, ClipboardList, Package, Sun, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/farm", key: "today", icon: Sun },
  { href: "/farm/orders", key: "orders", icon: ClipboardList },
  { href: "/farm/customers", key: "customers", icon: Users },
  { href: "/farm/catalogue", key: "catalogue", icon: Package },
  { href: "/farm/slots", key: "slots", icon: CalendarClock },
] as const

export function FarmNav({ toConfirm }: { toConfirm: number }) {
  const t = useTranslations("farm.nav")
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid max-w-2xl grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom,0px)] print:hidden">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = href === "/farm" ? path === "/farm" : path.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("relative flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium", active ? "font-semibold text-primary" : "text-muted-foreground")}
          >
            <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", active && "bg-accent")}>
              <Icon className="size-6" />
            </span>
            {t(key)}
            {key === "orders" && toConfirm > 0 && (
              <span className="absolute left-1/2 top-1 ml-2 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-destructive-foreground tabular-nums">
                {toConfirm}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
