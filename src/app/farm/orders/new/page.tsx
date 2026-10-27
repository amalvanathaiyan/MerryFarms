import { getLocale, getTranslations } from "next-intl/server"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { loadOrderFormData } from "@/server/order-form"
import { OrderForm } from "@/components/farm/order-form"

/** Farm staff take an order: by phone, typed in from WhatsApp, or a walk-in sale. */
export default async function NewOrderPage() {
  const { tenant } = await requireStaff(ORDER_DESK)
  const locale = await getLocale()
  const t = await getTranslations("farm.orderForm")
  const tc = await getTranslations("common")
  const data = await loadOrderFormData(tenant, locale, { today: tc("today"), tomorrow: tc("tomorrow") })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("newTitle")}</h1>
      <OrderForm data={data} mode={{ kind: "new" }} />
    </div>
  )
}
