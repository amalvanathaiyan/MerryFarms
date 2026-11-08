import { getTranslations } from "next-intl/server"
import { saveAccount } from "@/app/actions/account"
import { requireStaff } from "@/lib/auth"
import { DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { usernameOf } from "@/server/usernames"
import { AccountForm } from "./account-form"

/** Everyone on the farm, whatever their role: their own name and password (and username, for farm admins). */
export default async function AccountPage() {
  const { staff } = await requireStaff()
  const t = await getTranslations("farm.account")
  // Farm admins (owners) may sign in with a username too; other staff use their Staff ID.
  const username = staff.roles.includes("owner") ? ((await usernameOf(staff.authUserId)) ?? "") : null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <AccountForm name={staff.name} staffCode={staff.staffCode} email={staff.email} username={username} canChangePassword={!staff.authUserId.startsWith(DEMO_AUTH_PREFIX)} save={saveAccount} />
    </div>
  )
}
