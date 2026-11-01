import { getTranslations } from "next-intl/server"
import { farmKnownFromAddress, getTenant } from "@/lib/tenant"
import { LoginForm } from "./login-form"
import { isDemoLoginEnabled, DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { tenantDb } from "@/lib/tenant-db"
import { prisma } from "@/lib/prisma"
import { demoSignIn } from "@/app/actions/auth"
import { AuthShell } from "@/components/auth-shell"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const t = await getTranslations("login")
  const tenant = await getTenant()
  // Only allow redirects back into the farm app or the platform admin.
  const forAdmin = next?.startsWith("/admin") ?? false
  const target = next?.startsWith("/farm") || forAdmin ? next! : "/farm"
  const demoStaff = !isDemoLoginEnabled()
    ? []
    : forAdmin
      ? (await prisma.platformAdmin.findMany({ where: { authUserId: { startsWith: DEMO_AUTH_PREFIX } }, orderBy: { createdAt: "asc" } })).map((a) => ({ id: a.id, name: a.name, authUserId: a.authUserId }))
      : tenant
        ? await tenantDb(tenant.id).staffMember.findMany({ where: { authUserId: { startsWith: DEMO_AUTH_PREFIX }, isActive: true }, orderBy: { createdAt: "asc" } })
        : []
  const notice = error === "not_admin" ? t("notAdmin") : error === "not_staff" ? t("notStaff") : error === "auth_failed" ? t("authFailed") : null

  return (
    <AuthShell title={forAdmin ? t("adminTitle") : t("title")}>
      {notice && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {notice}
        </p>
      )}
      {demoStaff.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-dashed bg-yolk p-4 text-yolk-foreground">
          <h2 className="font-semibold">{t("demoTitle")}</h2>
          <p className="text-sm">{t("demoHint")}</p>
          {demoStaff.map((s) => (
            <form key={s.id} action={demoSignIn.bind(null, s.authUserId, forAdmin ? "/admin" : "/farm")}>
              <button type="submit" className="w-full rounded-xl bg-card px-4 py-3 text-left font-medium text-card-foreground">
                {s.name}
              </button>
            </form>
          ))}
        </section>
      )}
      <LoginForm next={target} forAdmin={forAdmin} farmKnown={await farmKnownFromAddress()} />
    </AuthShell>
  )
}
