import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { formatIndianMobile } from "@/domain/phone"
import { featuresOf } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { SettingsForm } from "@/components/farm/settings-form"
import { SectionHeader } from "@/components/farm/section-header"

/** Settings · Shop (owner): the farm's name, phones, payment and tax details, delivery charge. */
export default async function SettingsShopPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(featuresOf(tenant))} active="shop" back={{ href: "/farm/more" }} />
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
