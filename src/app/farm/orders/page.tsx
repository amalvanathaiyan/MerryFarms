import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { OrderStatus } from "@prisma/client"
import { requireStaff } from "@/lib/auth"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { isOpen, orderCode } from "@/domain/orders"
import { formatIndianMobile } from "@/domain/phone"
import { liteOrderMessage, waMeLink, type LiteMessageKind } from "@/domain/whatsapp-lite"
import { OrderActions } from "@/components/farm/order-actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { templateOverrides } from "@/server/messages"
import { directionsLink } from "@/domain/delivery-area"
import { featuresOf } from "@/lib/features"

const TABS: Record<string, OrderStatus[]> = {
  to_confirm: ["to_confirm"],
  open: ["confirmed", "packed", "out_for_delivery"],
  done: ["delivered", "cancelled"],
}

const MESSAGE_FOR: Partial<Record<OrderStatus, LiteMessageKind>> = {
  to_confirm: "received",
  confirmed: "confirmed",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams
  const { tenant, db, staff } = await requireStaff()
  const isDesk = staff.roles.includes("owner") || staff.roles.includes("order_desk")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("farm.orders")
  const tc = await getTranslations("common")
  const ts = await getTranslations("shop")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }

  const counts = await db.order.groupBy({ by: ["status"], _count: { _all: true } })
  const countFor = (k: string) => counts.filter((c) => TABS[k].includes(c.status)).reduce((a, c) => a + c._count._all, 0)
  // The call tab only shows while calls are on, or while old orders still wait in it.
  const tabs = Object.keys(TABS).filter((k) => k !== "to_confirm" || features.callConfirmation || countFor(k) > 0)
  const tab = rawTab && tabs.includes(rawTab) ? rawTab : tabs[0]

  const [orders, overrides] = await Promise.all([
    db.order.findMany({
      where: { status: { in: TABS[tab] } },
      include: {
        customer: true,
        address: true,
        items: { include: { product: true } },
        calls: { orderBy: { at: "desc" } },
        invoices: { where: { type: { not: "credit_note" } }, select: { id: true } },
        returns: { select: { amountPaise: true } },
      },
      orderBy: tab === "done" ? { updatedAt: "desc" } : [{ slotDate: "asc" }, { createdAt: "asc" }],
      take: tab === "done" ? 50 : 200,
    }),
    templateOverrides(tenant.id),
  ])

  return (
    <div className="flex flex-col gap-4">
      {isDesk && (
        <div className="flex gap-2">
          <Button asChild size="lg" className="flex-1">
            <Link href="/farm/orders/new">{t("newOrder")}</Link>
          </Button>
          {features.subscriptions && (
            <Button asChild size="lg" variant="outline">
              <Link href="/farm/plans">{t("plans")}</Link>
            </Button>
          )}
        </div>
      )}
      <nav className="flex gap-2" aria-label="Order status">
        {tabs.map((k) => (
          <Link
            key={k}
            href={`/farm/orders?tab=${k}`}
            aria-current={tab === k ? "page" : undefined}
            className={cn("rounded-full border px-4 py-2 text-sm font-medium", tab === k ? "border-primary bg-accent" : "bg-card")}
          >
            {t(`tab_${k}`)} <span className="tabular-nums">{countFor(k)}</span>
          </Link>
        ))}
      </nav>

      {orders.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("empty")}</p>}

      {orders.map((o) => {
        const lang = o.customer.language
        const code = orderCode(tenant.invoicePrefix, o.number)
        const items = o.items.map((i) => ({
          name: pick(locale, i.product.nameTa, i.product.nameEn),
          pack: pick(locale, i.product.packTa, i.product.packEn),
          qty: i.qty,
        }))
        const slotText = o.channel === "walk_in" ? t("atFarm") : `${dayLabel(o.slotDate, locale, labels)} · ${o.slotLabel}`
        const kind = MESSAGE_FOR[o.status]
        // Message to the customer, in the customer's language.
        const waText = kind
          ? liteOrderMessage(
              kind,
              {
                code,
                customerName: o.customer.name,
                farmName: lang === "ta" ? tenant.nameTa : tenant.nameEn,
                items: o.items.map((i) => ({
                  name: lang === "ta" ? i.product.nameTa : i.product.nameEn,
                  pack: lang === "ta" ? i.product.packTa : i.product.packEn,
                  qty: i.qty,
                })),
                totalPaise: o.totalPaise,
                slotText: `${dayLabel(o.slotDate, lang, { today: lang === "ta" ? "இன்று" : "Today", tomorrow: lang === "ta" ? "நாளை" : "Tomorrow" })} ${o.slotLabel}`,
                paymentText: lang === "ta" ? (o.paymentMethod === "cash_on_delivery" ? "டெலிவரியில் பணம்" : "UPI") : o.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "UPI",
              },
              lang,
              overrides
            )
          : null
        const lastNoAnswer = o.calls.filter((c) => c.outcome === "no_answer").length

        return (
          <article key={o.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <b className="tabular-nums">{code}</b>
                <span className="rounded-md border px-1.5 text-xs text-muted-foreground">{t(`channel_${o.channel}`)}</span>
                {o.subscriptionId && <span className="rounded-md bg-accent px-1.5 text-xs font-semibold">{t("planBadge")}</span>}
              </div>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold">{t(`status_${o.status}`)}</span>
            </div>
            <div>
              <Link href={`/farm/customers/${o.customer.id}`} className="font-semibold underline-offset-4 hover:underline">
                {o.customer.name}
              </Link>{" "}
              <span className="select-all text-sm text-muted-foreground tabular-nums">{formatIndianMobile(o.customer.phone)}</span>
              {o.address && (
                <div className="text-sm text-muted-foreground">
                  {o.address.line}
                  {o.address.landmark && ` · ${o.address.landmark}`}
                  {o.address.pincode && ` · ${o.address.pincode}`}
                  {o.address.lat != null && o.address.lng != null && (
                    <>
                      {" · "}
                      <a href={directionsLink({ lat: o.address.lat, lng: o.address.lng })} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                        📍 {t("directions")}
                        {o.distanceKm != null && ` (${o.distanceKm} km)`}
                      </a>
                      {/* How the spot was given matters: a phone's location may not be the delivery address. */}
                      {o.address.locationSource && ` · ${t(`spot_${o.address.locationSource as "gps" | "map" | "link"}`)}`}
                      {o.address.placeName && <span className="block">{o.address.placeName}</span>}
                    </>
                  )}
                </div>
              )}
              {o.address?.receiverName && o.address.receiverPhone && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium">{t("receiver", { name: o.address.receiverName })}</span>
                  <a href={`tel:${o.address.receiverPhone}`} className="font-medium text-primary tabular-nums underline-offset-4 hover:underline">
                    {formatIndianMobile(o.address.receiverPhone)} · {t("callReceiver")}
                  </a>
                </p>
              )}
              {o.pinCheck === "mismatch" && isOpen(o.status) && <p className="text-sm font-semibold text-yolk-foreground">{t("pinMismatch")}</p>}
              {o.areaCheck === "outside" && <p className="text-sm font-semibold text-destructive">{t("outsideArea")}</p>}
              {o.areaCheck === "unknown" && isOpen(o.status) && <p className="text-sm font-medium text-yolk-foreground">{t("areaUnchecked")}</p>}
            </div>
            <ul className="text-sm">
              {items.map((i) => (
                <li key={`${i.name}${i.pack}`}>
                  {i.qty} × {i.name} <span className="text-muted-foreground">({i.pack})</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
              <span>{slotText}</span>
              <span>
                <b className="text-foreground tabular-nums">{formatRupees(o.totalPaise)}</b> · {ts(`pay_${o.paymentMethod === "cash_on_delivery" ? "cash_on_delivery" : "upi_on_delivery"}`)}
              </span>
            </div>
            {o.returns.length > 0 && (
              <p className="text-sm font-medium text-destructive tabular-nums">
                {t("returnedAmount", { amount: formatRupees(o.returns.reduce((a, r) => a + r.amountPaise, 0)) })}
              </p>
            )}
            {o.note && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                {t("note")}: {o.note}
              </p>
            )}
            {o.status === "to_confirm" && lastNoAnswer > 0 && <p className="text-sm font-medium text-destructive">{t("attempts", { count: lastNoAnswer })}</p>}
            <OrderActions
              orderId={o.id}
              status={o.status}
              phone={o.customer.phone}
              callScript={`${items.map((i) => `${i.qty} × ${i.name} (${i.pack})`).join(", ")} · ${slotText} · ${formatRupees(o.totalPaise)}`}
              waLink={features.whatsappLite && waText ? waMeLink(o.customer.phone, waText) : null}
              invoiceId={o.invoices[0]?.id ?? null}
              allowCredit={features.creditAccounts}
              canEdit={isDesk && o.channel !== "walk_in"}
              canReturn={isDesk && features.returns}
            />
          </article>
        )
      })}
    </div>
  )
}
