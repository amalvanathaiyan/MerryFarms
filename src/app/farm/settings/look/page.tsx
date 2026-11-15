import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { settingsTabs } from "@/lib/farm-sections"
import { LogoForm } from "@/components/farm/logo-form"
import { BrandForm } from "@/components/farm/brand-form"
import { ShopArtPicker } from "@/components/farm/shop-art-picker"
import { DRAWINGS, defaultShopArt, typeOf } from "@/components/art/drawing-library"
import { SectionHeader } from "@/components/farm/section-header"
import { StoryForm } from "@/components/farm/story-form"
import { directoryUrl } from "@/lib/farm-url"

/** Settings · Look (owner): the farm's logo, its name colours and tagline, its story for Farm For You, and the drawings on its shop. */
export default async function SettingsLookPage() {
  const { tenant, db } = await requireStaff(OWNER_ONLY)
  // What the farm sells decides the suggested shop drawings, and which drawing groups come first.
  const categories = await db.category.findMany({ where: { deletedAt: null }, select: { kind: true, nameEn: true, nameTa: true } })
  const kinds = [...new Set(categories.map((c) => typeOf(c.kind, c.nameEn, c.nameTa)))]
  const suggested = defaultShopArt(kinds)
  const picked = tenant.shopArt.filter((id) => DRAWINGS.has(id))
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(featuresOf(tenant))} active="look" back={{ href: "/farm/more" }} />
      <LogoForm logoUrl={tenant.logoUrl} initials={tenant.invoicePrefix} />
      <BrandForm nameTa={tenant.nameTa} nameEn={tenant.nameEn} taglineTa={tenant.taglineTa} taglineEn={tenant.taglineEn} nameColours={tenant.nameColours} themePrimary={tenant.themePrimary} themeAccent={tenant.themeAccent} />
      <StoryForm storyTa={tenant.storyTa} storyEn={tenant.storyEn} profileUrl={directoryUrl(tenant.slug)} />
      <ShopArtPicker picked={picked.length ? picked : suggested} isDefault={picked.length === 0} kinds={kinds} suggested={suggested} />
    </div>
  )
}
