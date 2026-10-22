import { getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { CatalogueManager } from "@/components/farm/catalogue-manager"
import { featuresOf } from "@/lib/features"
import { offerActive } from "@/domain/offers"
import { istDate } from "@/domain/ist"

export default async function CataloguePage() {
  const { db, staff, tenant } = await requireStaff()
  const t = await getTranslations("farm.catalogue")
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ])

  const today = istDate(new Date())

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <CatalogueManager
        canEdit={staff.roles.includes("owner")}
        tracksStock={featuresOf(tenant).stockTracking}
        today={today}
        categories={categories.map(({ id, nameTa, nameEn }) => ({ id, nameTa, nameEn }))}
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
          gstRate: p.gstRate as 0 | 5 | 12 | 18,
          hsn: p.hsn ?? "",
          isActive: p.isActive,
          imageUrl: p.imageUrl,
          offerRupees: p.offerPricePaise != null ? p.offerPricePaise / 100 : null,
          offerEndsOn: p.offerEndsOn ?? "",
          offerLive: offerActive(p, today),
        }))}
      />
    </div>
  )
}
