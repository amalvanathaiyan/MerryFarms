import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { formatIndianMobile } from "@/domain/phone"
import { cannotEnable, FEATURE_KEYS, FEATURES, parseChoices, resolveFeatures } from "@/domain/features"
import { SettingsForm } from "@/components/farm/settings-form"
import { FeatureSwitches, type FeatureRow } from "@/components/farm/feature-switches"
import { DeliveryAreaForm } from "@/components/farm/delivery-area-form"
import { LogoForm } from "@/components/farm/logo-form"
import { ShopArtPicker } from "@/components/farm/shop-art-picker"
import { DRAWINGS, defaultShopArt } from "@/components/art/drawing-library"
import { artFor } from "@/domain/product-art"

export default async function SettingsPage() {
  const { tenant, db } = await requireStaff(OWNER_ONLY)
  const t = await getTranslations("farm.settings")
  // What the farm sells decides the suggested shop drawings, and which drawing groups come first.
  const categories = await db.category.findMany({ where: { deletedAt: null }, select: { kind: true, nameEn: true, nameTa: true } })
  const kinds = [...new Set(categories.map((c) => artFor(c.kind, c.nameEn, c.nameTa)))]
  const suggested = defaultShopArt(kinds)
  const picked = tenant.shopArt.filter((id) => DRAWINGS.has(id))

  const choices = parseChoices(tenant.features)
  const resolved = resolveFeatures(tenant.plan, choices)
  const rows: FeatureRow[] = FEATURE_KEYS.map((key) => {
    const locked = cannotEnable(tenant.plan, key)
    const chosen = choices[key] ?? FEATURES[key].defaultOn
    return {
      key,
      on: locked ? false : chosen,
      locked,
      blockedBy: !locked && chosen && !resolved[key] ? (FEATURES[key].requires.find((r) => !resolved[r]) ?? null) : null,
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <Link href="/farm/slots" className="flex items-center justify-between rounded-2xl border bg-card p-4 font-semibold">
        {t("slotsLink")} <span aria-hidden>→</span>
      </Link>
      <Link href="/farm/staff" className="flex items-center justify-between rounded-2xl border bg-card p-4 font-semibold">
        {t("staffLink")} <span aria-hidden>→</span>
      </Link>
      <LogoForm logoUrl={tenant.logoUrl} initials={tenant.invoicePrefix} />
      <ShopArtPicker picked={picked.length ? picked : suggested} isDefault={picked.length === 0} kinds={kinds} suggested={suggested} />
      <FeatureSwitches rows={rows} />
      {resolved.deliveryArea && (
        <DeliveryAreaForm
          initial={{
            location: tenant.farmLat != null && tenant.farmLng != null ? { lat: tenant.farmLat, lng: tenant.farmLng } : null,
            radiusKm: tenant.deliveryRadiusKm,
            pincodes: tenant.servedPincodes,
          }}
        />
      )}
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
