import { getTranslations } from "next-intl/server"
import { saveAdminAccount } from "@/app/actions/account"
import { AccountForm } from "@/app/farm/account/account-form"
import { requirePlatformAdmin } from "@/lib/auth"
import { DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { usernameOf } from "@/server/usernames"

/** A super admin's own name, username and password. */
export default async function AdminAccountPage() {
  const admin = await requirePlatformAdmin()
  const t = await getTranslations("farm.account")
  const username = (await usernameOf(admin.authUserId)) ?? ""

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <AccountForm name={admin.name} staffCode={null} email={admin.email} username={username} canChangePassword={!admin.authUserId.startsWith(DEMO_AUTH_PREFIX)} save={saveAdminAccount} />
    </div>
  )
}
