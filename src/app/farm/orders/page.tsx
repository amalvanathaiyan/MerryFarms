import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { OrderStatus } from "@prisma/client"
import { requireStaff } from "@/lib/auth"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { orderCode } from "@/domain/orders"
import { formatIndianMobile } from "@/domain/phone"
import { liteOrderMessage, waMeLink, type LiteMessageKind } from "@/domain/whatsapp-lite"
import { OrderActions } from "@/components/farm/order-actions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

  const [orders] = await Promise.all([
    db.order.findMany({
      where: { status: { in: TABS[tab] } },
      include: {
        customer: true,
        address: true,
        items: { include: { product: true } },
        calls: { orderBy: { at: "desc" } },
        invoices: { where: { type: { not: "credit_note" } }, select: { id: true } },
      },
      orderBy: tab === "done" ? { updatedAt: "desc" } : [{ slotDate: "asc" }, { createdAt: "asc" }],
      take: tab === "done" ? 50 : 200,
    }),
  ])

  return (
    <div className="flex flex-col gap-4">
      {isDesk && (
        <Button asChild size="lg">
          <Link href="/farm/orders/new">{t("newOrder")}</Link>
        </Button>
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
              lang
            )
          : null
        const lastNoAnswer = o.calls.filter((c) => c.outcome === "no_answer").length

        return (
          <article key={o.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <b className="tabular-nums">{code}</b>
                <span className="rounded-md border px-1.5 text-xs text-muted-foreground">{t(`channel_${o.channel}`)}</span>
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
                </div>
              )}
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
            />
          </article>
        )
      })}
    </div>
  )
}
