import { getLocale, getTranslations } from "next-intl/server"
import Link from "next/link"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { pick } from "@/lib/i18n-helpers"
import { featuresOf } from "@/lib/features"
import { moneyTabs } from "@/lib/farm-sections"
import { addDays, istDate } from "@/domain/ist"
import { SectionHeader } from "@/components/farm/section-header"
import { ProductionSection } from "@/components/farm/production-section"

/** Money · Made (owner and packing): what was made or collected each day, per product; good quantity goes into stock. */
export default async function MoneyMadePage() {
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "farmRecords")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.records")
  const today = istDate(new Date())
  const [products, entries] = await Promise.all([
    db.product.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.productionEntry.findMany({ where: { date: { gte: addDays(today, -13) } } }),
  ])

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="money" tabs={moneyTabs({ roles: staff.roles, features })} active="made" />
      <ProductionSection
        today={today}
        toStock={features.stockTracking}
        products={products.map((p) => ({ id: p.id, name: pick(locale, p.nameTa, p.nameEn), pack: pick(locale, p.packTa, p.packEn), unit: p.stockUnit }))}
        entries={entries.map((e) => ({ date: e.date, productId: e.productId, made: e.made, wasted: e.wasted }))}
      />
      {products.length === 0 && (
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">
          {t("noProducts")}{" "}
          <Link href="/farm/catalogue" className="font-semibold text-primary underline underline-offset-4">
            {t("addProducts")}
          </Link>
        </p>
      )}
    </div>
  )
}
