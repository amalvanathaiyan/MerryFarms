import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { formatIndianMobile } from "@/domain/phone"
import { SettingsForm } from "@/components/farm/settings-form"

export default async function SettingsPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("farm.settings")
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <SettingsForm
        initial={{
          nameTa: tenant.nameTa,
          nameEn: tenant.nameEn,
          phone: formatIndianMobile(tenant.phone),
          whatsappNumber: tenant.whatsappNumber ? formatIndianMobile(tenant.whatsappNumber) : "",
          upiId: tenant.upiId ?? "",
          gstin: tenant.gstin ?? "",
          fssaiNo: tenant.fssaiNo ?? "",
          deliveryFeeRupees: tenant.deliveryFeePaise / 100,
          freeAboveRupees: tenant.freeAbovePaise / 100,
        }}
      />
    </div>
  )
}
