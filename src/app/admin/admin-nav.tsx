"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Blocks, Inbox, Layers, Tractor } from "lucide-react"
import { cn } from "@/lib/utils"

/** Farm For You admin's menu: farms, plans, modules, requests (with how many are waiting). Words beside every icon. */
export function AdminNav({ pending }: { pending: number }) {
  const t = useTranslations("admin.nav")
  const path = usePathname()
  const items = [
    { href: "/admin", key: "farms", icon: Tractor, active: path === "/admin" || path.startsWith("/admin/farms") },
    { href: "/admin/plans", key: "plans", icon: Layers, active: path.startsWith("/admin/plans") },
    { href: "/admin/modules", key: "modules", icon: Blocks, active: path.startsWith("/admin/modules") },
    { href: "/admin/requests", key: "requests", icon: Inbox, active: path.startsWith("/admin/requests"), badge: pending },
  ]
  return (
    <nav aria-label={t("label")} className="mx-auto flex w-full max-w-6xl gap-1.5 overflow-x-auto px-4 pb-2 sm:px-6">
      {items.map(({ href, key, icon: Icon, active, badge }) => (
        <Link
          key={key}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn("relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary hover:text-primary")}
        >
          <Icon className="size-4" aria-hidden />
          {t(key)}
          {!!badge && <span className="min-w-5 rounded-full bg-brand-accent px-1.5 text-center text-xs leading-5 font-bold text-brand-accent-foreground tabular-nums">{badge}</span>}
        </Link>
      ))}
    </nav>
  )
}
