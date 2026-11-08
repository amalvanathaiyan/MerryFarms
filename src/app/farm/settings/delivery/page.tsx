import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Clock } from "lucide-react"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { DeliveryAreaForm } from "@/components/farm/delivery-area-form"
import { SectionHeader } from "@/components/farm/section-header"

/** Settings · Delivery (owner): where the farm delivers, and a way to its delivery times. */
export default async function SettingsDeliveryPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("farm.settings")
  const area = featuresOf(tenant).deliveryArea
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs()} active="delivery" back={{ href: "/farm/more" }} />
      <Link href="/farm/slots" className="flex items-center justify-between gap-3 rounded-2xl bg-sec-slots-tint p-4 text-lg font-bold">
        <span className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-sec-slots text-sec-on">
            <Clock className="size-6" aria-hidden />
          </span>
          {t("slotsLink")}
        </span>
        <span aria-hidden>→</span>
      </Link>
      {area ? (
        <DeliveryAreaForm
          initial={{
            location: tenant.farmLat != null && tenant.farmLng != null ? { lat: tenant.farmLat, lng: tenant.farmLng } : null,
            radiusKm: tenant.deliveryRadiusKm,
            pincodes: tenant.servedPincodes,
          }}
        />
      ) : (
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("areaOff")}</p>
      )}
    </div>
  )
}
