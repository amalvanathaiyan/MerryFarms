import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { AuthShell } from "@/components/auth-shell"
import { farmUrl } from "@/lib/farm-url"
import { createSSRClient } from "@/lib/supabase/server"
import { RegisterForm } from "./register-form"

export default async function RegisterPage() {
  const t = await getTranslations("login")
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createSSRClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) redirect("/farm")
  }
  const open = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!farmUrl("x")

  return (
    <AuthShell title={t("registerTitle")}>
      {open ? (
        <RegisterForm domain={process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost"} />
      ) : (
        <>
          <p className="rounded-lg bg-accent px-3 py-3">{t("signup_closed")}</p>
          <Link href="/login" className="text-center font-medium text-primary underline underline-offset-2">
            {t("backToSignIn")}
          </Link>
        </>
      )}
    </AuthShell>
  )
}
