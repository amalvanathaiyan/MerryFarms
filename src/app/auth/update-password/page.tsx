import { getTranslations } from "next-intl/server"
import { AuthShell } from "@/components/auth-shell"
import { NewPasswordForm } from "./new-password-form"

export default async function UpdatePasswordPage() {
  const t = await getTranslations("login")
  return (
    <AuthShell title={t("newPasswordTitle")}>
      <NewPasswordForm />
    </AuthShell>
  )
}
