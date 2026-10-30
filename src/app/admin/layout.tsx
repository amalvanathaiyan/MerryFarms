import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { LogOut } from "lucide-react"
import { requirePlatformAdmin } from "@/lib/auth"
import { LanguageToggle } from "@/components/language-toggle"
import { WheelMark } from "@/components/art/wheel-mark"
import { signOutAdmin } from "@/app/actions/auth"

export const dynamic = "force-dynamic"

/** FarmForYou platform admin: every farm on the platform. Only for people in platform_admins. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin()
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-header/95 text-header-foreground backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
          <Link href="/admin" className="flex min-w-[10rem] flex-1 items-center gap-3">
            <WheelMark tone="tile" className="size-10" />
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-lg font-bold leading-tight" lang="en">
                FarmForYou
              </span>
              <span className="truncate text-xs opacity-80">
                {t("platformAdmin")} · {admin.name}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle compact />
            <form action={signOutAdmin}>
              <button type="submit" className="flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[11px] leading-none font-medium hover:bg-accent hover:text-primary">
                <LogOut className="size-5" aria-hidden />
                {tc("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
