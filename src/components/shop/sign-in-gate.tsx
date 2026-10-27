import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { Tenant } from "@/lib/tenant"
import { pick } from "@/lib/i18n-helpers"
import { FarmBanner } from "@/components/farm-banner"
import { SignInFlow } from "@/components/shop/sign-in-flow"
import { CartArt } from "@/components/art/cart-art"

/** The first screen for someone this phone doesn't know yet: mobile number, then a code. */
export async function SignInGate({ tenant }: { tenant: Tenant }) {
  const locale = await getLocale()
  const t = await getTranslations("signIn")
  const name = pick(locale, tenant.nameTa, tenant.nameEn)
  return (
    <div className="min-h-dvh">
      <FarmBanner name={name} initials={tenant.invoicePrefix} />
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <CartArt variant="scene" priority className="rounded-3xl border" />
        <div>
          <h1 className="text-2xl font-bold">{t("welcome")}</h1>
          <p className="mt-1 text-muted-foreground">{t("welcomeHint", { farm: name })}</p>
        </div>
        <SignInFlow />
        <Link href="/?browse" className="py-2 text-center font-medium text-primary underline-offset-4 hover:underline">
          {t("justBrowse")} →
        </Link>
      </main>
    </div>
  )
}
