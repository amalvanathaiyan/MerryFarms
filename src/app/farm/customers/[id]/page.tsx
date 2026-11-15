import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { MessageCircle, Phone } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { dayLabel } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { orderCode } from "@/domain/orders"
import { formatIndianMobile } from "@/domain/phone"
import { runningBalances, withinCreditLimit } from "@/domain/ledger"
import { waMeLink } from "@/domain/whatsapp-lite"
import { istDate } from "@/domain/ist"
import { Button } from "@/components/ui/button"
import { CustomerEditor } from "@/components/farm/customer-editor"
import { PaymentForm } from "@/components/farm/payment-form"
import { cn } from "@/lib/utils"
import { featuresOf } from "@/lib/features"
import { templateOverrides } from "@/server/messages"
import { fillTemplate, templateText } from "@/domain/templates"
import { ensureToken } from "@/server/customers"
import { shopUrl } from "@/lib/urls"
import { PersonalLink } from "@/components/farm/personal-link"
import { BackLink } from "@/components/farm/section-header"
import { isCustomerKind } from "@/domain/customers"

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ known?: string }> }) {
  const { id } = await params
  const { known } = await searchParams
  const { tenant, db, staff } = await requireStaff()
  const locale = await getLocale()
  const t = await getTranslations("farm.customers")
  const to = await getTranslations("farm.orders")
  const tc = await getTranslations("common")
  const features = featuresOf(tenant)

  const customer = await db.customer.findFirst({ where: { id }, include: { addresses: { orderBy: { createdAt: "desc" }, take: 3 } } })
  if (!customer) notFound()

  const [entries, orders, invoices, plans, consents] = await Promise.all([
    db.ledgerEntry.findMany({ where: { customerId: id }, orderBy: { at: "asc" } }),
    db.order.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.invoice.findMany({ where: { customerId: id }, select: { id: true, orderId: true, number: true } }),
    db.subscription.findMany({ where: { customerId: id, status: { not: "cancelled" } }, select: { id: true, status: true } }),
    db.customerConsent.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ])
  const statement = runningBalances(entries)
  const balance = statement.at(-1)?.balancePaise ?? 0
  const invoiceByOrder = new Map(invoices.map((i) => [i.orderId, i]))
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }

  const farmName = customer.language === "ta" ? tenant.nameTa : tenant.nameEn
  const duesText = fillTemplate(templateText("dues", customer.language, await templateOverrides(tenant.id)), {
    name: customer.name,
    farm: farmName,
    amount: formatRupees(balance),
    upi: tenant.upiId ?? "",
  })
  const canLink = features.customerAccounts && (staff.roles.includes("owner") || staff.roles.includes("order_desk"))
  const personalLink = canLink ? await shopUrl(`/my/${await ensureToken(tenant.id, customer.id)}`) : null
  const linkText = personalLink
    ? fillTemplate(templateText("personal_link", customer.language, await templateOverrides(tenant.id)), { name: customer.name, farm: farmName, link: personalLink })
    : ""
  const overLimit = customer.creditLimitPaise > 0 && !withinCreditLimit(balance, customer.creditLimitPaise, 0)

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/farm/customers" label={(await getTranslations("farm.sections"))("customers.title")} />
      {known === "1" && <p className="rounded-lg bg-accent px-3 py-2 text-sm font-medium">{t("alreadyCustomer")}</p>}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{customer.name}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="select-all tabular-nums">{formatIndianMobile(customer.phone)}</span>
              {customer.phoneVerifiedAt && <span className="ms-2 rounded bg-accent px-1.5 text-xs font-medium text-foreground">{t("phoneChecked")}</span>}
              {!customer.phoneVerifiedAt && customer.emailVerifiedAt && <span className="ms-2 rounded bg-yolk px-1.5 text-xs font-medium text-yolk-foreground">{t("phoneUnchecked")}</span>}
            </p>
            {customer.email && customer.emailVerifiedAt && <p className="break-all text-sm text-muted-foreground">{customer.email}</p>}
            {customer.source && <p className="text-sm text-muted-foreground">{t("cameBy", { how: t(`source_${customer.source}`) })}</p>}
            {customer.addresses[0] && (
              <p className="text-sm text-muted-foreground">
                {customer.addresses[0].line}
                {customer.addresses[0].landmark && ` · ${customer.addresses[0].landmark}`}
              </p>
            )}
          </div>
          {features.creditAccounts && (
          <div className="shrink-0 text-right">
            <div className="text-xs text-muted-foreground">{t("balance")}</div>
            <div className={cn("text-2xl font-bold tabular-nums", balance > 0 && "text-destructive")}>{formatRupees(Math.abs(balance))}</div>
            {balance < 0 && <div className="text-xs">{t("advance")}</div>}
          </div>
          )}
        </div>
        {features.creditAccounts && overLimit && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{t("overLimit", { limit: formatRupees(customer.creditLimitPaise) })}</p>}
        <div className="flex flex-wrap gap-2">
          <Button asChild className="flex-1">
            <a href={`tel:${customer.phone}`}>
              <Phone /> {to("call")}
            </a>
          </Button>
          {features.creditAccounts && features.whatsappLite && balance > 0 && (
            <Button asChild variant="outline" className="flex-1">
              <a href={waMeLink(customer.phone, duesText)} target="_blank" rel="noreferrer">
                <MessageCircle /> {t("sendDues")}
              </a>
            </Button>
          )}
        </div>
      </section>

      {personalLink && <PersonalLink customerId={customer.id} link={personalLink} waLink={features.whatsappLite ? waMeLink(customer.phone, linkText) : null} />}

      {features.creditAccounts && <PaymentForm customerId={customer.id} suggestedRupees={balance > 0 ? balance / 100 : undefined} />}

      {features.creditAccounts && (
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("statement")}</h2>
        {statement.length === 0 ? (
          <p className="text-muted-foreground">{t("noEntries")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-semibold">{t("date")}</th>
                  <th className="py-2 pr-2 font-semibold">{t("entry")}</th>
                  <th className="py-2 pr-2 text-right font-semibold">{t("amount")}</th>
                  <th className="py-2 text-right font-semibold">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {statement
                  .slice()
                  .reverse()
                  .map((e) => (
                    <tr key={e.id} className="border-b border-dashed">
                      <td className="py-2 pr-2">{dayLabel(istDate(e.at), locale, labels)}</td>
                      <td className="py-2 pr-2">{t(`type_${e.type}`)}</td>
                      <td className={cn("py-2 pr-2 text-right", e.type === "payment" && "text-primary")}>
                        {e.type === "payment" ? "−" : ""}
                        {formatRupees(Math.abs(e.amountPaise))}
                      </td>
                      <td className="py-2 text-right">{formatRupees(e.balancePaise)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {features.subscriptions && (
        <section className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <span className="font-semibold">{t("plans", { count: plans.length })}</span>
          <Link href={plans.length ? "/farm/plans" : "/farm/plans/new"} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {plans.length ? t("seePlans") : t("startPlan")}
          </Link>
        </section>
      )}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("recentOrders")}</h2>
        {orders.length === 0 ? (
          <p className="text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <ul className="divide-y">
            {orders.map((o) => {
              const inv = invoiceByOrder.get(o.id)
              return (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <b className="tabular-nums">{orderCode(tenant.invoicePrefix, o.number)}</b> · {dayLabel(o.slotDate, locale, labels)} · {to(`status_${o.status}`)}
                  </span>
                  <span className="flex items-center gap-3 tabular-nums">
                    {formatRupees(o.totalPaise)}
                    {inv && (
                      <Link href={`/farm/invoices/${inv.id}`} className="text-primary underline-offset-4 hover:underline">
                        {inv.number}
                      </Link>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <CustomerEditor
        canEdit={staff.roles.includes("owner") || staff.roles.includes("order_desk")}
        showCredit={features.creditAccounts}
        showTrusted={features.callConfirmation}
        customer={{
          id: customer.id,
          name: customer.name,
          language: customer.language,
          isTrusted: customer.isTrusted,
          creditLimitRupees: customer.creditLimitPaise / 100,
          marketingOptIn: customer.marketingOptIn,
          smsOptIn: customer.smsOptIn,
          kind: isCustomerKind(customer.kind) ? customer.kind : "home",
          notes: customer.notes ?? "",
        }}
      />

      {consents.length > 0 && (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">{t("consentLog")}</summary>
          <ul className="mt-2 divide-y text-sm">
            {consents.map((k) => (
              <li key={k.id} className="py-2">
                {t(k.given ? "consentGiven" : "consentStopped", { channel: t(`channel_${k.channel}`) })} · {t(`consent_${k.how}`)} · {dayLabel(istDate(k.createdAt), locale, labels)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
