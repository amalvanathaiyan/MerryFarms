import { getLocale, getTranslations } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import { dayLabel, istTime, pick } from "@/lib/i18n-helpers"
import { slotRangeLabel } from "@/domain/slots"
import { istDate } from "@/domain/ist"
import { openSlotOptions } from "@/server/orders"
import { Shop, type ShopData } from "@/components/shop/shop"

export const dynamic = "force-dynamic"

/** The farm's customer shop: Tamil first, works without login. */
export default async function ShopPage() {
  const tenant = await getTenant()
  if (!tenant) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Farm4U</h1>
        <p className="mt-2 text-muted-foreground">No farm is set up at this address.</p>
      </main>
    )
  }

  const locale = await getLocale()
  const t = await getTranslations("common")
  const db = tenantDb(tenant.id)
  const [categories, products, options] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.product.findMany({
      where: { isActive: true, onWeb: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    openSlotOptions(tenant.id),
  ])

  const labels = { today: t("today"), tomorrow: t("tomorrow") }
  const firstOpen = options.find((o) => !o.full)

  const data: ShopData = {
    farm: {
      name: pick(locale, tenant.nameTa, tenant.nameEn),
      phone: tenant.phone,
      whatsappNumber: tenant.whatsappNumber ?? tenant.phone,
      orderPrefix: tenant.invoicePrefix,
      deliveryFeePaise: tenant.deliveryFeePaise,
      freeAbovePaise: tenant.freeAbovePaise,
      paused: tenant.status === "suspended",
    },
    categories: categories
      .filter((c) => products.some((p) => p.categoryId === c.id))
      .map((c) => ({ id: c.id, name: pick(locale, c.nameTa, c.nameEn) })),
    products: products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: pick(locale, p.nameTa, p.nameEn),
      pack: pick(locale, p.packTa, p.packEn),
      note: pick(locale, p.noteTa, p.noteEn),
      pricePaise: p.pricePaise,
      stockQty: p.stockQty,
    })),
    slots: options.map((o) => ({
      key: o.key,
      label: `${dayLabel(o.date, locale, labels)} · ${slotRangeLabel(o.slot.startTime, o.slot.endTime)}`,
      full: o.full,
      left: o.left,
    })),
    nextDelivery: firstOpen
      ? {
          label: `${dayLabel(firstOpen.date, locale, labels)} · ${slotRangeLabel(firstOpen.slot.startTime, firstOpen.slot.endTime)}`,
          orderBy: `${dayLabel(istDate(firstOpen.cutoffAt), locale, labels)} ${istTime(firstOpen.cutoffAt, locale)}`,
        }
      : null,
  }

  return <Shop data={data} />
}
