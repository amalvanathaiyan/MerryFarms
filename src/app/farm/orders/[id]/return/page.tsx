import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ORDER_DESK, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { pick } from "@/lib/i18n-helpers"
import { orderCode } from "@/domain/orders"
import { returnable } from "@/domain/returns"
import { ReturnForm } from "@/components/farm/return-form"

/** Record goods returned or short delivered after an order was delivered. */
export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenant, db } = await requireStaff(ORDER_DESK)
  requireFeature(tenant, "returns")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.returns")

  const order = await db.order.findFirst({ where: { id }, include: { items: { include: { product: true } }, returns: true, customer: true } })
  if (!order) notFound()
  const code = orderCode(tenant.invoicePrefix, order.number)
  if (order.status !== "delivered") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{code}</h1>
        <p className="rounded-xl bg-yolk p-4 text-yolk-foreground">{t("onlyDelivered")}</p>
      </div>
    )
  }

  const earlier = order.returns.map((r) => r.items as unknown as { productId: string; qty: number }[])
  const left = returnable(order.items, earlier)
  const paidOnAccount = order.paymentMethod === "credit"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">{t("title", { code })}</h1>
        <p className="text-sm text-muted-foreground">{order.customer.name}</p>
      </div>
      <ReturnForm
        orderId={order.id}
        lines={order.items.map((i) => ({
          productId: i.productId,
          name: pick(locale, i.product.nameTa, i.product.nameEn),
          pack: pick(locale, i.product.packTa, i.product.packEn),
          unitPricePaise: i.unitPricePaise,
          left: left.get(i.productId) ?? 0,
        }))}
        deliveryFeePaise={order.returns.some((r) => r.deliveryFeePaise > 0) ? 0 : order.deliveryFeePaise}
        tracksStock={features.stockTracking}
        allowAccount={features.creditAccounts}
        defaultRefund={paidOnAccount && features.creditAccounts ? "account" : "cash"}
        earlierReturns={order.returns.map((r) => ({ id: r.id, at: r.at.toISOString(), amountPaise: r.amountPaise, reason: r.reason }))}
      />
    </div>
  )
}

