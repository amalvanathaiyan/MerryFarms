import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { Phone } from "lucide-react"
import { requireTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { getSessionCustomer } from "@/lib/customer-session"
import { tenantDb } from "@/lib/tenant-db"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { customerBalance } from "@/server/billing"
import { formatRupees } from "@/domain/money"
import { orderCode, isOpen } from "@/domain/orders"
import { formatIndianMobile } from "@/domain/phone"
import { LanguageToggle } from "@/components/language-toggle"
import { Button } from "@/components/ui/button"
import { ConnectForm } from "@/components/shop/connect-form"
import { ForgetMe } from "@/components/shop/forget-me"
import { unreadForCustomer } from "@/server/chat"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const STEPS = ["to_confirm", "confirmed", "packed", "out_for_delivery", "delivered"] as const

/** "My orders": the customer's own page, recognised by the key on their phone. */
export default async function MyPage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const { link } = await searchParams
  const tenant = await requireTenant()
  const features = featuresOf(tenant)
  if (!features.customerAccounts) notFound()
  const locale = await getLocale()
  const t = await getTranslations("my")
  const to = await getTranslations("farm.orders")
  const tc = await getTranslations("common")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const me = await getSessionCustomer()
  const farmName = pick(locale, tenant.nameTa, tenant.nameEn)

  const header = (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-header px-4 py-3 text-header-foreground">
      <Link href="/" className="min-w-0">
        <span className="line-clamp-2 font-semibold leading-snug">{farmName}</span>
      </Link>
      <LanguageToggle compact />
    </header>
  )

  if (!me) {
    return (
      <div className="mx-auto min-h-dvh max-w-md">
        {header}
        <main className="flex flex-col gap-5 px-4 py-6">
          <h1 className="text-2xl font-bold">{t("connectTitle")}</h1>
          {link === "expired" && <p className="rounded-lg bg-yolk p-3 text-sm text-yolk-foreground">{t("linkExpired")}</p>}
          <p className="text-muted-foreground">{t("connectHint", { farm: farmName })}</p>
          <ConnectForm farmPhone={tenant.phone} />
        </main>
      </div>
    )
  }

  const db = tenantDb(tenant.id)
  const [orders, invoices, balance, unread] = await Promise.all([
    db.order.findMany({ where: { customerId: me.id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.invoice.findMany({ where: { customerId: me.id }, select: { orderId: true, publicToken: true, number: true, type: true } }),
    features.creditAccounts ? customerBalance(tenant.id, me.id) : Promise.resolve(0),
    features.messages ? unreadForCustomer(tenant.id, me.id) : Promise.resolve(0),
  ])
  const open = orders.filter((o) => isOpen(o.status))
  const past = orders.filter((o) => !isOpen(o.status))
  const invoiceFor = (orderId: string) => invoices.find((i) => i.orderId === orderId && i.type !== "credit_note")
  const itemsText = (o: (typeof orders)[number]) => o.items.map((i) => `${i.qty} × ${pick(locale, i.product.nameTa, i.product.nameEn)} (${pick(locale, i.product.packTa, i.product.packEn)})`).join(", ")
  const slotText = (o: (typeof orders)[number]) => (o.channel === "walk_in" ? to("atFarm") : `${dayLabel(o.slotDate, locale, labels)} · ${o.slotLabel}`)

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-10">
      {header}
      <main className="flex flex-col gap-5 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">{t("hello", { name: me.name })}</h1>
          <p className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(me.phone)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="lg">
            <Link href="/">{t("shop")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={`tel:${tenant.phone}`}>
              <Phone /> {t("callFarm")}
            </a>
          </Button>
        </div>

        {features.messages && (
          <Link href="/my/messages" className="flex items-center justify-between rounded-2xl border bg-card p-4 font-semibold">
            <span>💬 {t("messageFarm")}</span>
            {unread > 0 ? (
              <span className="rounded-full bg-destructive px-2 text-sm font-bold leading-6 text-destructive-foreground">{t("newReplies", { count: unread })}</span>
            ) : (
              <span aria-hidden>→</span>
            )}
          </Link>
        )}

        {features.creditAccounts && balance !== 0 && (
          <section className="rounded-2xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{balance > 0 ? t("dues") : t("advance")}</div>
            <div className="text-2xl font-bold tabular-nums">{formatRupees(Math.abs(balance))}</div>
            {balance > 0 && tenant.upiId && <p className="mt-1 text-sm tabular-nums">UPI: {tenant.upiId}</p>}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("onTheWay")}</h2>
          {open.length === 0 && <p className="text-sm text-muted-foreground">{t("noOpen")}</p>}
          {open.map((o) => {
            const step = STEPS.indexOf(o.status as (typeof STEPS)[number])
            return (
              <article key={o.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
                <div className="flex justify-between gap-2">
                  <b className="tabular-nums">{orderCode(tenant.invoicePrefix, o.number)}</b>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold">{to(`status_${o.status}`)}</span>
                </div>
                <p className="text-sm">{itemsText(o)}</p>
                <div className="grid grid-cols-5 gap-1" aria-hidden>
                  {STEPS.map((s, i) => (
                    <span key={s} className={i <= step ? "h-1.5 rounded-full bg-primary" : "h-1.5 rounded-full bg-muted"} />
                  ))}
                </div>
                <div className="flex justify-between text-sm text-muted-foreground tabular-nums">
                  <span>{slotText(o)}</span>
                  <span>{formatRupees(o.totalPaise)}</span>
                </div>
              </article>
            )
          })}
        </section>

        {past.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t("past")}</h2>
            {past.map((o) => {
              const inv = invoiceFor(o.id)
              return (
                <article key={o.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="tabular-nums">
                      <b>{orderCode(tenant.invoicePrefix, o.number)}</b> · {dayLabel(o.slotDate, locale, labels)}
                    </span>
                    <span className="text-muted-foreground">{to(`status_${o.status}`)}</span>
                  </div>
                  <p className="text-sm">{itemsText(o)}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="tabular-nums">{formatRupees(o.totalPaise)}</b>
                    <div className="flex gap-2">
                      {inv && (
                        <Button asChild variant="ghost" size="sm">
                          <a href={`/i/${inv.publicToken}`}>{t("bill")}</a>
                        </Button>
                      )}
                      {features.webShop && (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/?reorder=${o.id}`}>{t("orderAgain")}</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}

        <ForgetMe />
      </main>
    </div>
  )
}
