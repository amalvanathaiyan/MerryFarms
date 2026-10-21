import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { MessageCircle } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { absoluteUrl } from "@/lib/urls"
import { InvoiceView } from "@/components/invoice-view"
import { PrintButton } from "@/components/print-button"
import { Button } from "@/components/ui/button"
import { readSnapshot } from "@/server/billing"
import { formatRupees } from "@/domain/money"
import { waMeLink } from "@/domain/whatsapp-lite"
import { featuresOf } from "@/lib/features"

export default async function FarmInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, tenant } = await requireStaff()
  const t = await getTranslations("farm.invoice")
  const invoice = await db.invoice.findFirst({
    where: { id },
    include: { customer: true, creditNotes: { select: { id: true, number: true, totalPaise: true } }, refInvoice: { select: { id: true, number: true } } },
  })
  if (!invoice) notFound()

  const s = readSnapshot(invoice.snapshot)
  const link = await absoluteUrl(`/i/${invoice.publicToken}`)
  const lang = invoice.customer.language
  const farmName = lang === "ta" ? s.farm.nameTa : s.farm.nameEn
  const text =
    lang === "ta"
      ? `வணக்கம் ${s.customer.name}, ${farmName} பில் ${s.number}: ${formatRupees(s.totalPaise)}.\n${link}`
      : `Hello ${s.customer.name}, your ${farmName} bill ${s.number}: ${formatRupees(s.totalPaise)}.\n${link}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        {featuresOf(tenant).whatsappLite && (
          <Button asChild className="flex-1">
            <a href={waMeLink(invoice.customer.phone, text)} target="_blank" rel="noreferrer">
              <MessageCircle /> {t("sendWhatsApp")}
            </a>
          </Button>
        )}
        <PrintButton label={t("print")} />
        <Button asChild variant="ghost">
          <Link href={`/farm/customers/${invoice.customerId}`}>{t("customer")}</Link>
        </Button>
      </div>
      {(invoice.creditNotes.length > 0 || invoice.refInvoice) && (
        <div className="flex flex-wrap gap-2 text-sm print:hidden">
          {invoice.refInvoice && (
            <Link href={`/farm/invoices/${invoice.refInvoice.id}`} className="rounded-full border bg-card px-3 py-1 tabular-nums">
              {t("against")} {invoice.refInvoice.number}
            </Link>
          )}
          {invoice.creditNotes.map((c) => (
            <Link key={c.id} href={`/farm/invoices/${c.id}`} className="rounded-full border border-destructive/40 bg-card px-3 py-1 text-destructive tabular-nums">
              {c.number} · −{formatRupees(c.totalPaise)}
            </Link>
          ))}
        </div>
      )}
      <InvoiceView s={s} />
    </div>
  )
}
