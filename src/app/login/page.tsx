import { getLocale, getTranslations } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { LoginForm } from "./login-form"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const t = await getTranslations("login")
  const tenant = await getTenant()
  const locale = await getLocale()
  // Only allow redirects back into the farm app.
  const target = next?.startsWith("/farm") ? next : "/farm"

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{tenant ? pick(locale, tenant.nameTa, tenant.nameEn) : "Farm4U"}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>
      {error === "not_staff" && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {t("notStaff")}
        </p>
      )}
      <LoginForm next={target} />
    </main>
  )
}
