import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { FarmNav } from "@/components/farm/farm-nav"
import Link from "next/link"
import { BarChart3, LogOut, MessageCircle, Settings } from "lucide-react"
import { featuresOf } from "@/lib/features"
import { signOut } from "@/app/actions/auth"
import { WheelMark } from "@/components/art/wheel-mark"

export const dynamic = "force-dynamic"

const ICON_LINK = "grid size-10 place-items-center rounded-full opacity-80 hover:bg-accent hover:opacity-100"

export default async function FarmLayout({ children }: { children: React.ReactNode }) {
  const { tenant, staff, db } = await requireStaff()
  const locale = await getLocale()
  const t = await getTranslations("common")
  const toConfirm = await db.order.count({ where: { status: "to_confirm" } })
  const messagesOn = featuresOf(tenant).messages
  const unread = messagesOn ? await db.message.count({ where: { sender: "customer", seenAt: null } }) : 0

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-header/95 text-header-foreground backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6">
          {/* The name keeps at least 10rem; on narrow phones the icons wrap to a second line instead of squeezing it out. */}
          <div className="flex min-w-[10rem] flex-1 items-center gap-3">
            <WheelMark tone="tile" className="size-10" title="FarmForYou" />
            <div className="min-w-0">
              <div className="font-display line-clamp-2 text-lg font-bold leading-snug break-words">{pick(locale, tenant.nameTa, tenant.nameEn)}</div>
              <div className="truncate text-xs opacity-80">{staff.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle compact />
            {featuresOf(tenant).whatsappLite && (
              <Link href="/farm/whatsapp" aria-label="WhatsApp" className={ICON_LINK}>
                <MessageCircle className="size-5" />
              </Link>
            )}
            {staff.roles.includes("owner") && featuresOf(tenant).reports && (
              <Link href="/farm/reports" aria-label={t("reports")} className={ICON_LINK}>
                <BarChart3 className="size-5" />
              </Link>
            )}
            {staff.roles.includes("owner") && (
              <Link href="/farm/settings" aria-label={t("settings")} className={ICON_LINK}>
                <Settings className="size-5" />
              </Link>
            )}
            <form action={signOut}>
              {/* Phones: an icon (the label stays for screen readers). Wider screens: the word. */}
              <button type="submit" className="grid h-10 min-w-10 place-items-center rounded-full px-2 text-sm opacity-80 underline-offset-4 hover:underline hover:opacity-100" title={t("signOut")}>
                <LogOut className="size-5 sm:hidden" aria-hidden />
                <span className="max-sm:sr-only">{t("signOut")}</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      {/* Phones and tablets: the menu is a bar along the bottom. Desktops: a menu down the left. */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 lg:gap-8 lg:px-6">
        <FarmNav toConfirm={toConfirm} unread={unread} messagesOn={messagesOn} />
        <main className="min-w-0 flex-1 px-4 pt-4 pb-28 sm:px-6 lg:px-0 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
