import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { FarmNav } from "@/components/farm/farm-nav"
import Link from "next/link"
import { MessageCircle, Settings } from "lucide-react"
import { featuresOf } from "@/lib/features"
import { signOut } from "@/app/actions/auth"

export const dynamic = "force-dynamic"

export default async function FarmLayout({ children }: { children: React.ReactNode }) {
  const { tenant, staff, db } = await requireStaff()
  const locale = await getLocale()
  const t = await getTranslations("common")
  const toConfirm = await db.order.count({ where: { status: "to_confirm" } })

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-header px-4 py-3 text-header-foreground print:hidden">
        <div className="min-w-0">
          <div className="truncate font-semibold">{pick(locale, tenant.nameTa, tenant.nameEn)}</div>
          <div className="truncate text-xs opacity-80">{staff.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {featuresOf(tenant).whatsappLite && (
            <Link href="/farm/whatsapp" aria-label="WhatsApp" className="opacity-80 hover:opacity-100">
              <MessageCircle className="size-5" />
            </Link>
          )}
          {staff.roles.includes("owner") && (
            <Link href="/farm/settings" aria-label={t("settings")} className="opacity-80 hover:opacity-100">
              <Settings className="size-5" />
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="text-sm opacity-80 underline-offset-4 hover:underline hover:opacity-100">
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <FarmNav toConfirm={toConfirm} />
    </div>
  )
}
