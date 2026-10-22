import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { featuresOf } from "@/lib/features"
import { pick, weekdayNames } from "@/lib/i18n-helpers"
import { slotRangeLabel } from "@/domain/slots"
import { istDate } from "@/domain/ist"
import type { Tenant } from "@/lib/tenant"
import type { PlanFormData } from "@/components/farm/plan-form"
import { currentPrice } from "@/domain/offers"

export async function loadPlanFormData(tenant: Tenant, locale: string): Promise<PlanFormData> {
  const db = tenantDb(tenant.id)
  const [products, slots] = await Promise.all([
    db.product.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.deliverySlot.findMany({ where: { isActive: true }, orderBy: { startTime: "asc" } }),
  ])
  return {
    products: products.map((p) => ({ id: p.id, name: pick(locale, p.nameTa, p.nameEn), pack: pick(locale, p.packTa, p.packEn), pricePaise: currentPrice(p, istDate(new Date())) })),
    slots: slots.map((s) => ({ id: s.id, label: `${pick(locale, s.nameTa, s.nameEn)} · ${slotRangeLabel(s.startTime, s.endTime)}`, daysOfWeek: s.daysOfWeek })),
    weekdays: weekdayNames(locale),
    creditAccounts: featuresOf(tenant).creditAccounts,
    today: istDate(new Date()),
  }
}
