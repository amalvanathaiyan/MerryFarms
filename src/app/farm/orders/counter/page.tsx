import { getLocale, getTranslations } from "next-intl/server"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { loadOrderFormData } from "@/server/order-form"
import { isValidUpiId } from "@/domain/upi"
import { SectionHeader } from "@/components/farm/section-header"
import { CounterSale } from "@/components/farm/counter-sale"

/** A quick sale at the farm gate or a market stall: what they take and how they paid. No name needed. */
export default async function CounterSalePage() {
  const { tenant } = await requireStaff(ORDER_DESK)
  const locale = await getLocale()
  const t = await getTranslations("farm.counter")
  const tc = await getTranslations("common")
  const features = featuresOf(tenant)
  const data = await loadOrderFormData(tenant, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const upi = features.upiPayments && tenant.upiId && isValidUpiId(tenant.upiId) ? { id: tenant.upiId, payee: tenant.nameEn } : null

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="orders" back={{ href: "/farm/orders" }} />
      <div>
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <CounterSale
        products={data.products.map((p) => ({ id: p.id, name: p.name, pack: p.pack, pricePaise: p.pricePaise, stockQty: data.tracksStock ? p.stockQty : null }))}
        upi={upi}
      />
    </div>
  )
}
