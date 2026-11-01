import { getLocale } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { CartArt } from "@/components/art/cart-art"
import { WheelMark } from "@/components/art/wheel-mark"

/** Sign-in, register and password pages: FarmForYou's cart on the farm road beside the form; above it on phones. */
export async function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  const tenant = await getTenant()
  const locale = await getLocale()

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 md:gap-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <WheelMark tone="tile" className="size-12" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-xl font-bold" lang="en">
              FarmForYou
            </span>
            <span className="text-sm text-muted-foreground">{tenant ? pick(locale, tenant.nameTa, tenant.nameEn) : ""}</span>
          </div>
        </div>
        <CartArt variant="scene" priority className="rounded-3xl border" />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6 justify-self-center">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          <LanguageToggle />
        </div>
        {children}
      </div>
    </main>
  )
}
