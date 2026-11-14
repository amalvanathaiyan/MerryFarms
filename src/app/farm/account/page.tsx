import { saveAccount } from "@/app/actions/account"
import { requireNotSupport } from "@/lib/auth"
import { SupportLog } from "@/components/farm/support-log"
import { DEMO_AUTH_PREFIX } from "@/lib/demo-auth"
import { usernameOf } from "@/server/usernames"
import { AccountForm } from "./account-form"
import { SectionHeader } from "@/components/farm/section-header"
import { DisplaySettings } from "@/components/display-settings"
import { SoundSetting } from "@/components/sound-setting"

/** Everyone on the farm, whatever their role: their own name and password (and username, for farm admins). */
export default async function AccountPage() {
  const { staff, tenant } = await requireNotSupport()
  // Farm admins (owners) may sign in with a username too; other staff use their Staff ID.
  const username = staff.storedRoles.includes("owner") ? ((await usernameOf(staff.authUserId)) ?? "") : null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="account" back={{ href: "/farm/more" }} />
      <AccountForm name={staff.name} staffCode={staff.staffCode} email={staff.email} username={username} canChangePassword={!staff.authUserId.startsWith(DEMO_AUTH_PREFIX)} save={saveAccount} />
      <DisplaySettings />
      <SoundSetting />
      {staff.storedRoles.includes("owner") && <SupportLog tenantId={tenant.id} />}
    </div>
  )
}
