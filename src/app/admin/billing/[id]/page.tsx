import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { pick } from "@/lib/i18n-helpers"
import { istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { invoiceState } from "@/domain/platform-billing"
import { invoiceWithPayments } from "@/server/platform-billing"
import { prisma } from "@/lib/prisma"
import { PlatformInvoiceSheet } from "@/components/platform-invoice-sheet"
import { PrintButton } from "@/components/print-button"
import { InvoiceBadge } from "@/components/invoice-badge"
import { PaymentForm, RemovePayment, VoidInvoice } from "./invoice-actions"

/**
 * Admin · One invoice: as the farm sees it, and beside it what admin does with it: record money received (the
 * invoice is paid once it reaches the total), take back a payment entered by mistake, or cancel an unpaid invoice.
 */
export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inv = await invoiceWithPayments(id)
  if (!inv) notFound()
  const t = await getTranslations("admin.billing")
  const locale = await getLocale()
  const farm = await prisma.tenant.findUnique({ where: { id: inv.tenantId }, select: { id: true, nameTa: true, nameEn: true } })
  const today = istDate(new Date())
  const state = invoiceState(inv, today)
  const date = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const fmt = (d: string) => date.format(new Date(`${d}T00:00:00Z`))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/admin/billing" className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
          <ArrowLeft className="size-4" aria-hidden /> {t("title")}
        </Link>
        {farm && (
          <Link href={`/admin/farms/${farm.id}`} className="rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
            {pick(locale, farm.nameTa, farm.nameEn)}
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold tabular-nums">{inv.number}</h1>
          <InvoiceBadge state={state} label={t(`state_${state}`)} className="text-sm" />
        </div>
        {state === "void" ? (
          inv.voidReason && <p className="text-sm text-muted-foreground">{t("voidReason", { reason: inv.voidReason })}</p>
        ) : inv.leftPaise > 0 ? (
          <>
            <p className="font-medium">{t("leftToPay", { amount: formatRupees(inv.leftPaise), date: fmt(inv.dueOn) })}</p>
            <PaymentForm invoiceId={inv.id} leftRupees={inv.leftPaise / 100} today={today} />
          </>
        ) : (
          <p className="font-medium text-primary">{t("allPaid")}</p>
        )}

        {inv.payments.length > 0 && (
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold">{t("payments")}</h2>
            <ul className="flex flex-col divide-y text-sm">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="tabular-nums">
                    <b>{formatRupees(p.amountPaise)}</b> · {t(`method_${p.method}`)} · {fmt(p.paidOn)}
                    {p.reference && <span className="font-mono text-muted-foreground"> · {p.reference}</span>}
                  </span>
                  <RemovePayment id={p.id} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <PrintButton label={t("print")} />
          {state !== "void" && inv.payments.length === 0 && <VoidInvoice id={inv.id} />}
        </div>
      </section>

      <PlatformInvoiceSheet inv={inv} />
    </div>
  )
}
