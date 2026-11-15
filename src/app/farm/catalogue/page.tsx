import { requireStaff } from "@/lib/auth"
import { CatalogueManager } from "@/components/farm/catalogue-manager"
import { featuresOf } from "@/lib/features"
import { offerActive } from "@/domain/offers"
import { istDate } from "@/domain/ist"
import { SectionHeader } from "@/components/farm/section-header"
import { EggStoreCard } from "@/components/farm/egg-store-card"
import { getLocale } from "next-intl/server"
import { pick } from "@/lib/i18n-helpers"
import { farmHolds } from "@/server/compliance"
import { listKinds } from "@/server/product-kinds"
import { readDetails, readPacks, type DetailValues } from "@/domain/product-kinds"
import { isArtKind } from "@/domain/product-art"

export default async function CataloguePage() {
  const { db, staff, tenant } = await requireStaff()
  const [categories, products, holds, kinds] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    farmHolds(tenant.id),
    listKinds(true),
  ])
  // Kinds offered for new categories (not retired), plus any retired one a category already uses.
  const usedKinds = new Set(categories.map((c) => c.productKindId).filter(Boolean))
  const offered = kinds.filter((k) => !k.retired || usedKinds.has(k.id))

  const today = istDate(new Date())
  const features = featuresOf(tenant)
  const locale = await getLocale()
  // Egg products share the farm's egg store (shown when stock is tracked and the farm has any).
  const eggProducts = features.stockTracking ? products.filter((p) => p.eggsPerUnit && p.isActive) : []

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="products" back={{ href: "/farm/more" }} />
      {eggProducts.length > 0 && staff.roles.some((r) => r === "owner" || r === "packing") && (
        <EggStoreCard
          eggs={tenant.eggStore}
          fromBatches={features.poultryCare}
          products={eggProducts.map((p) => ({ id: p.id, name: `${pick(locale, p.nameTa, p.nameEn)} · ${pick(locale, p.packTa, p.packEn)}`, eggsPerUnit: p.eggsPerUnit! }))}
        />
      )}
      <CatalogueManager
        canEdit={staff.roles.includes("owner")}
        tracksStock={features.stockTracking}
        today={today}
        kinds={offered.map((k) => ({ id: k.id, nameTa: k.nameTa, nameEn: k.nameEn, art: isArtKind(k.art) ? k.art : "basket", packs: k.packs, details: k.details, hsn: k.hsn, gstRate: k.gstRate, retired: k.retired }))}
        categories={categories.map(({ id, nameTa, nameEn, kind, productKindId, packs, details }) => ({ id, nameTa, nameEn, kind, productKindId, packs: readPacks(packs), details: readDetails(details) }))}
        products={products.map((p) => ({
          id: p.id,
          categoryId: p.categoryId,
          nameTa: p.nameTa,
          nameEn: p.nameEn,
          packTa: p.packTa,
          packEn: p.packEn,
          noteTa: p.noteTa ?? "",
          noteEn: p.noteEn ?? "",
          priceRupees: p.pricePaise / 100,
          stockQty: p.stockQty,
          stockUnit: p.stockUnit,
          eggsPerUnit: p.eggsPerUnit,
          gstRate: p.gstRate as 0 | 5 | 12 | 18,
          hsn: p.hsn ?? "",
          isActive: p.isActive,
          imageUrl: p.imageUrl,
          offerRupees: p.offerPricePaise != null ? p.offerPricePaise / 100 : null,
          offerEndsOn: p.offerEndsOn ?? "",
          offerLive: offerActive(p, today),
          details: p.details && typeof p.details === "object" && !Array.isArray(p.details) ? (p.details as DetailValues) : {},
          held: holds[p.id] ? { reason: pick(locale, holds[p.id].note ?? holds[p.id].reasonTa, holds[p.id].note ?? holds[p.id].reasonEn), checking: holds[p.id].status === "open" } : null,
        }))}
      />
    </div>
  )
}
