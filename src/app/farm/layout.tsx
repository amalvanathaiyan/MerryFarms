import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { FarmNav } from "@/components/farm/farm-nav"
import Link from "next/link"
import { Settings } from "lucide-react"
import { signOut } from "@/app/actions/auth"

export const dynamic = "force-dynamic"

export default async function FarmLayout({ children }: { children: React.ReactNode }) {
  const { tenant, staff, db } = await requireStaff()
  const locale = await getLocale()
  const t = await getTranslations("common")
  const toConfirm = await db.order.count({ where: { status: "to_confirm" } })

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="truncate font-semibold">{pick(locale, tenant.nameTa, tenant.nameEn)}</div>
          <div className="truncate text-xs text-muted-foreground">{staff.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          {staff.roles.includes("owner") && (
            <Link href="/farm/settings" aria-label={t("settings")} className="text-muted-foreground hover:text-foreground">
              <Settings className="size-5" />
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
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
