import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { DEMO_AUTH_PREFIX, isDemoLoginEnabled } from "@/lib/demo-auth"
import { StaffManager } from "@/components/farm/staff-manager"

/** Owner only: who works on the farm app and what each person can do. */
export default async function StaffPage() {
  const { db, staff } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("farm.staff")
  const members = await db.staffMember.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <StaffManager
        demo={isDemoLoginEnabled() && !process.env.SUPABASE_SERVICE_ROLE_KEY}
        rows={members.map((m) => ({
          id: m.id,
          name: m.name,
          staffCode: m.staffCode,
          email: m.email,
          phone: m.phone,
          roles: m.roles,
          isActive: m.isActive,
          isMe: m.id === staff.id,
          demo: m.authUserId.startsWith(DEMO_AUTH_PREFIX),
        }))}
      />
    </div>
  )
}
