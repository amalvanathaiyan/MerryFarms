import { getLocale } from "next-intl/server"
import { CheerProvider } from "@/components/cheer"
import { requireStaff } from "@/lib/auth"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { FarmNav } from "@/components/farm/farm-nav"
import { featuresOf } from "@/lib/features"
import { mainMenu } from "@/lib/farm-sections"
import { WheelMark } from "@/components/art/wheel-mark"
import type { Metadata } from "next"
import { getTenant } from "@/lib/tenant"
import { appIcon, appIdentity } from "@/domain/install-apps"
import { InstallCatcher } from "@/components/install-app"
import { HeaderHeight } from "@/components/header-height"
import { SupportBar } from "@/components/farm/support-bar"

export const dynamic = "force-dynamic"

/** Installing from the farm app gives its own green icon that opens straight into the farm app (not the shop). */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const id = appIdentity("farm", tenant)
  return { manifest: "/app-manifest?app=farm", appleWebApp: { capable: true, title: id.shortName, statusBarStyle: "default" }, icons: { apple: appIcon("farm", tenant?.logoUrl, 180) } }
}

export default async function FarmLayout({ children }: { children: React.ReactNode }) {
  const { tenant, staff, db, support } = await requireStaff()
  const locale = await getLocale()
  const features = featuresOf(tenant)
  const items = mainMenu({ roles: staff.roles, features })
  const toConfirm = await db.order.count({ where: { status: "to_confirm" } })
  const unread = features.messages ? await db.message.count({ where: { sender: "customer", seenAt: null } }) : 0

  return (
    <div className="flex min-h-dvh flex-col">
      <InstallCatcher />
      {support && <SupportBar farm={pick(locale, tenant.nameTa, tenant.nameEn)} endsAt={support.endsAt} />}
      {/* Only the farm and the language here: everything else is one tap away in the menu (More). */}
      <HeaderHeight id="app-header" />
      <header id="app-header" className="sticky top-0 z-20 border-b bg-header/95 text-header-foreground backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- small logo served by our own route
              <img src={tenant.logoUrl} alt="" className="size-11 shrink-0 rounded-xl border bg-card object-contain" />
            ) : (
              <WheelMark tone="tile" className="size-11" title="FarmForYou" />
            )}
            <div className="min-w-0">
              <div className="font-display line-clamp-2 text-lg leading-snug font-bold break-words">{pick(locale, tenant.nameTa, tenant.nameEn)}</div>
              <div className="line-clamp-2 text-sm leading-snug break-words opacity-80">{staff.name}</div>
            </div>
          </div>
          <LanguageToggle compact />
        </div>
      </header>
      {/* Phones and tablets: the menu is a bar along the bottom. Desktops: a menu down the left. */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 lg:gap-8 lg:px-6">
        <FarmNav items={items} badges={{ orders: toConfirm, more: unread }} />
        <main className="min-w-0 flex-1 px-4 pt-4 pb-32 sm:px-6 lg:px-0 lg:pt-6 lg:pb-12">
          <div className="mx-auto w-full max-w-3xl">
            <CheerProvider>{children}</CheerProvider>
          </div>
        </main>
      </div>
    </div>
  )
}
