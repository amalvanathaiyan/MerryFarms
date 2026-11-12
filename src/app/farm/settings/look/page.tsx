import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { LogoForm } from "@/components/farm/logo-form"
import { BrandForm } from "@/components/farm/brand-form"
import { ShopArtPicker } from "@/components/farm/shop-art-picker"
import { DRAWINGS, defaultShopArt } from "@/components/art/drawing-library"
import { artFor } from "@/domain/product-art"
import { SectionHeader } from "@/components/farm/section-header"

/** Settings · Look (owner): the farm's logo, its name colours and tagline, and the drawings on its shop. */
export default async function SettingsLookPage() {
  const { tenant, db } = await requireStaff(OWNER_ONLY)
  // What the farm sells decides the suggested shop drawings, and which drawing groups come first.
  const categories = await db.category.findMany({ where: { deletedAt: null }, select: { kind: true, nameEn: true, nameTa: true } })
  const kinds = [...new Set(categories.map((c) => artFor(c.kind, c.nameEn, c.nameTa)))]
  const suggested = defaultShopArt(kinds)
  const picked = tenant.shopArt.filter((id) => DRAWINGS.has(id))
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(featuresOf(tenant))} active="look" back={{ href: "/farm/more" }} />
      <LogoForm logoUrl={tenant.logoUrl} initials={tenant.invoicePrefix} />
      <BrandForm nameTa={tenant.nameTa} nameEn={tenant.nameEn} taglineTa={tenant.taglineTa} taglineEn={tenant.taglineEn} nameColours={tenant.nameColours} />
      <ShopArtPicker picked={picked.length ? picked : suggested} isDefault={picked.length === 0} kinds={kinds} suggested={suggested} />
    </div>
  )
}
