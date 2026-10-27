import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { dayLabel } from "@/lib/i18n-helpers"
import { loadOrderFormData } from "@/server/order-form"
import { OrderForm } from "@/components/farm/order-form"
import { isEditable, orderCode } from "@/domain/orders"
import { slotKey } from "@/domain/slots"

/** Change an order before it's packed. With ?call=1 it comes from a "Changed" call outcome. */
export default async function EditOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ call?: string }> }) {
  const { id } = await params
  const { call } = await searchParams
  const { tenant, db } = await requireStaff(ORDER_DESK)
  const locale = await getLocale()
  const t = await getTranslations("farm.orderForm")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }

  const order = await db.order.findFirst({
    where: { id },
    include: { items: true, customer: { include: { addresses: { orderBy: { createdAt: "desc" }, take: 5 } } } },
  })
  if (!order || order.channel === "walk_in") notFound()
  if (!isEditable(order.status)) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{orderCode(tenant.invoicePrefix, order.number)}</h1>
        <p className="rounded-xl bg-yolk p-4 text-yolk-foreground">{t("notEditable")}</p>
      </div>
    )
  }

  const data = await loadOrderFormData(tenant, locale, labels, order.items.map((i) => i.productId))
  // Keep the order's current slot selectable even if it's no longer offered (e.g. switched off).
  const currentKey = order.slotId ? slotKey(order.slotDate, order.slotId) : ""
  if (currentKey && !data.slots.some((s) => s.key === currentKey)) {
    data.slots.unshift({ key: currentKey, label: `${dayLabel(order.slotDate, locale, labels)} · ${order.slotLabel}`, full: false, left: 0, afterCutoff: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("editTitle", { code: orderCode(tenant.invoicePrefix, order.number) })}</h1>
      {call === "1" && <p className="rounded-xl bg-accent p-3 text-sm">{t("fromCallHint")}</p>}
      <OrderForm
        data={data}
        mode={{
          kind: "edit",
          orderId: order.id,
          fromCall: call === "1" && order.status === "to_confirm",
          customer: {
            id: order.customer.id,
            name: order.customer.name,
            phone: order.customer.phone,
            language: order.customer.language,
            addresses: order.customer.addresses.map((a) => ({ id: a.id, line: a.line, landmark: a.landmark })),
          },
          initial: {
            items: Object.fromEntries(order.items.map((i) => [i.productId, i.qty])),
            slotKey: currentKey,
            addressId: order.addressId,
            paymentMethod: order.paymentMethod === "upi_prepaid" ? "upi_on_delivery" : order.paymentMethod,
            note: order.note ?? "",
            agreedPrices: Object.fromEntries(order.items.map((i) => [i.productId, i.unitPricePaise])),
          },
        }}
      />
    </div>
  )
}
