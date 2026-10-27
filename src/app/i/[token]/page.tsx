import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTenant } from "@/lib/tenant"
import { InvoiceView } from "@/components/invoice-view"
import { PrintButton } from "@/components/print-button"
import { Button } from "@/components/ui/button"
import { readSnapshot } from "@/server/billing"
import { upiPayLink } from "@/domain/upi"
import { featuresOf } from "@/lib/features"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The customer's copy of an invoice, opened from WhatsApp without logging in.
 * The long random token in the link is what grants access.
 */
export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound()

  const [invoice, tenant] = await Promise.all([prisma.invoice.findUnique({ where: { publicToken: token } }), getTenant()])
  // A farm's invoice only opens on that farm's own address.
  if (!invoice || (tenant && invoice.tenantId !== tenant.id)) notFound()

  const s = readSnapshot(invoice.snapshot)
  const farm = tenant ?? (await prisma.tenant.findUnique({ where: { id: invoice.tenantId } }))
  const pay = farm && featuresOf(farm).upiPayments && s.farm.upiId ? upiPayLink({ upiId: s.farm.upiId, payeeName: s.farm.nameEn, amountPaise: s.totalPaise, note: s.number }) : null

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 print:p-0">
      <InvoiceView s={s} />
      <div className="flex flex-wrap gap-2 print:hidden">
        {pay && (
          <Button asChild size="lg" className="flex-1">
            <a href={pay}>UPI மூலம் செலுத்து · Pay by UPI</a>
          </Button>
        )}
        <PrintButton label="சேமி / அச்சிடு · Save or print" />
      </div>
    </main>
  )
}
