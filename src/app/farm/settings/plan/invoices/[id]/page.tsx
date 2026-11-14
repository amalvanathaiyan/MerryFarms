import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { invoiceWithPayments } from "@/server/platform-billing"
import { PlatformInvoiceSheet } from "@/components/platform-invoice-sheet"
import { PrintButton } from "@/components/print-button"

/** An invoice from Farm For You (owner): how much, what for, and how to pay. Only the farm's own. */
export default async function FarmPlatformInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { tenant } = await requireStaff(OWNER_ONLY)
  const inv = await invoiceWithPayments(id, tenant.id)
  if (!inv) notFound()
  const t = await getTranslations("farm.planModules")
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href="/farm/settings/plan#invoices" className="flex min-h-11 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-semibold">
          <ArrowLeft className="size-4" aria-hidden /> {t("invoicesTitle")}
        </Link>
        <PrintButton label={t("print")} />
      </div>
      <PlatformInvoiceSheet inv={inv} />
    </div>
  )
}
