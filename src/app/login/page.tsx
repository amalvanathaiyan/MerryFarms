import { getLocale, getTranslations } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import { pick } from "@/lib/i18n-helpers"
import { LanguageToggle } from "@/components/language-toggle"
import { LoginForm } from "./login-form"
import { isDemoLoginEnabled, DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { tenantDb } from "@/lib/tenant-db"
import { demoSignIn } from "@/app/actions/auth"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const t = await getTranslations("login")
  const tenant = await getTenant()
  const locale = await getLocale()
  // Only allow redirects back into the farm app.
  const target = next?.startsWith("/farm") ? next : "/farm"
  const demoStaff =
    isDemoLoginEnabled() && tenant
      ? await tenantDb(tenant.id).staffMember.findMany({ where: { authUserId: { startsWith: DEMO_AUTH_PREFIX }, isActive: true }, orderBy: { createdAt: "asc" } })
      : []

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{tenant ? pick(locale, tenant.nameTa, tenant.nameEn) : "FarmForYou"}</p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>
      {error === "not_staff" && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {t("notStaff")}
        </p>
      )}
      {demoStaff.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-dashed bg-yolk p-4 text-yolk-foreground">
          <h2 className="font-semibold">{t("demoTitle")}</h2>
          <p className="text-sm">{t("demoHint")}</p>
          {demoStaff.map((s) => (
            <form key={s.id} action={demoSignIn.bind(null, s.authUserId)}>
              <button type="submit" className="w-full rounded-xl bg-card px-4 py-3 text-left font-medium text-card-foreground">
                {s.name}
              </button>
            </form>
          ))}
        </section>
      )}
      <LoginForm next={target} />
    </main>
  )
}
