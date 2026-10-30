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

// Header actions: an icon with its word under it, so staff new to apps can tell them apart.
const ICON_LINK =
  "flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[11px] leading-none max-xs:min-w-11 max-xs:px-1 max-xs:text-[10px] font-medium text-header-foreground/85 hover:bg-accent hover:text-primary"

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
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- small logo served by our own route
              <img src={tenant.logoUrl} alt="" className="size-10 shrink-0 rounded-xl border bg-card object-contain" />
            ) : (
              <WheelMark tone="tile" className="size-10" title="FarmForYou" />
            )}
            <div className="min-w-0">
              <div className="font-display line-clamp-2 text-lg font-bold leading-snug break-words">{pick(locale, tenant.nameTa, tenant.nameEn)}</div>
              <div className="truncate text-xs opacity-80">{staff.name}</div>
            </div>
          </div>
          {/* Language sits beside the name; the labelled actions take their own row on phones. */}
          <LanguageToggle compact />
          <div className="flex flex-wrap items-center gap-0.5 max-sm:w-full">
            {featuresOf(tenant).whatsappLite && (
              <Link href="/farm/whatsapp" className={ICON_LINK}>
                <MessageCircle className="size-5" aria-hidden />
                WhatsApp
              </Link>
            )}
            {staff.roles.includes("owner") && featuresOf(tenant).reports && (
              <Link href="/farm/reports" className={ICON_LINK}>
                <BarChart3 className="size-5" aria-hidden />
                {t("reports")}
              </Link>
            )}
            {staff.roles.includes("owner") && (
              <Link href="/farm/settings" className={ICON_LINK}>
                <Settings className="size-5" aria-hidden />
                {t("settings")}
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className={ICON_LINK}>
                <LogOut className="size-5" aria-hidden />
                {t("signOut")}
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
