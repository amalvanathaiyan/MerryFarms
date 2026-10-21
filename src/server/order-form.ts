import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { featuresOf } from "@/lib/features"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { slotRangeLabel } from "@/domain/slots"
import type { Tenant } from "@/lib/tenant"
import type { OrderFormData } from "@/components/farm/order-form"
import { openSlotOptions } from "./orders"

/**
 * Everything the farm's new/edit order form needs: products (plus any hidden ones
 * already on the order being edited) and every slot staff may book.
 */
export async function loadOrderFormData(
  tenant: Tenant,
  locale: string,
  labels: { today: string; tomorrow: string },
  keepProductIds: string[] = []
): Promise<OrderFormData> {
  const db = tenantDb(tenant.id)
  const features = featuresOf(tenant)
  const now = new Date()
  const [products, options] = await Promise.all([
    db.product.findMany({
      where: { deletedAt: null, OR: [{ isActive: true }, { id: { in: keepProductIds } }] },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    openSlotOptions(tenant.id, now, { forStaff: true }),
  ])
  return {
    products: products.map((p) => ({
      id: p.id,
      name: pick(locale, p.nameTa, p.nameEn),
      pack: pick(locale, p.packTa, p.packEn),
      pricePaise: p.pricePaise,
      stockQty: p.stockQty,
    })),
    slots: options.map((o) => ({
      key: o.key,
      label: `${dayLabel(o.date, locale, labels)} · ${slotRangeLabel(o.slot.startTime, o.slot.endTime)}`,
      full: o.full,
      left: o.left,
      afterCutoff: o.cutoffAt.getTime() <= now.getTime(),
    })),
    creditAccounts: features.creditAccounts,
    tracksStock: features.stockTracking,
    deliveryFeePaise: tenant.deliveryFeePaise,
    freeAbovePaise: tenant.freeAbovePaise,
  }
}
