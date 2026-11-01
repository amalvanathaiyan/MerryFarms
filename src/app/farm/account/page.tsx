import { getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { AccountForm } from "./account-form"

/** Everyone on the farm, whatever their role: their own name and password. */
export default async function AccountPage() {
  const { staff } = await requireStaff()
  const t = await getTranslations("farm.account")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <AccountForm name={staff.name} staffCode={staff.staffCode} email={staff.email} canChangePassword={!staff.authUserId.startsWith(DEMO_AUTH_PREFIX)} />
    </div>
  )
}
