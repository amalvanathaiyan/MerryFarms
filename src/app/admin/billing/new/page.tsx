import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { gstinState } from "@/domain/platform-billing"
import { draftLines } from "@/domain/platform-billing"
import { addDays, istDate } from "@/domain/ist"
import { billingProfile, invoiceDraftInputs } from "@/server/platform-billing"
import { NewInvoiceForm } from "./new-invoice-form"

const both = (ta: string, en: string) => (ta && en && ta !== en ? `${ta} · ${en}` : ta || en)

/**
 * Admin · New invoice. First which farm (skipped when coming from the farm's page), then the invoice, filled in from
 * the farm's plan and add-ons for the next period, every line still changeable.
 */
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ farm?: string }> }) {
  const { farm: farmId } = await searchParams
  const t = await getTranslations("admin.billing")
  const locale = await getLocale()
  const back = (
    <Link href={farmId ? `/admin/billing?farm=${farmId}` : "/admin/billing"} className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
      <ArrowLeft className="size-4" aria-hidden /> {t("title")}
    </Link>
  )
  const farm = farmId ? await prisma.tenant.findUnique({ where: { id: farmId }, select: { id: true, nameTa: true, nameEn: true, gstin: true } }) : null

  if (!farm) {
    const farms = await prisma.tenant.findMany({ orderBy: { nameEn: "asc" }, select: { id: true, nameTa: true, nameEn: true, slug: true } })
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {back}
        <h1 className="text-2xl font-bold">{t("pickFarm")}</h1>
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {farms.map((f) => (
            <li key={f.id}>
              <Link href={`/admin/billing/new?farm=${f.id}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 hover:bg-accent">
                <span className="flex flex-col">
                  <span className="font-semibold">{pick(locale, f.nameTa, f.nameEn)}</span>
                  <span className="text-sm text-muted-foreground" lang="en">
                    {f.slug}
                  </span>
                </span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const [inputs, profile, tmTa, tmEn] = await Promise.all([
    invoiceDraftInputs(farm.id),
    billingProfile(),
    getTranslations({ locale: "ta", namespace: "modules" }),
    getTranslations({ locale: "en", namespace: "modules" }),
  ])
  const draft = inputs.sub
    ? draftLines(
        inputs.sub,
        inputs.sub.plan,
        inputs.addOnPrices.map((a) => ({ ...a, name: both(tmTa(a.key), tmEn(a.key)) })),
        inputs.periodStart,
        both(inputs.sub.plan.nameTa, inputs.sub.plan.nameEn)
      )
    : { lines: [], periodStart: inputs.periodStart, periodEnd: null }
  const today = istDate(new Date())

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {back}
      <div>
        <h1 className="text-2xl font-bold">{t("newInvoiceFor", { farm: pick(locale, farm.nameTa, farm.nameEn) })}</h1>
        <p className="text-muted-foreground">{inputs.sub ? t("draftHint") : t("noPlanHint")}</p>
      </div>
      <NewInvoiceForm
        tenantId={farm.id}
        initial={{
          lines: draft.lines.map((l) => ({ text: l.text, rupees: l.amountPaise / 100 })),
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          dueOn: addDays(today, profile.dueDays),
        }}
        today={today}
        gst={profile.gstOn ? { rate: profile.gstRatePct, askState: !gstinState(farm.gstin), otherState: !!gstinState(farm.gstin) && gstinState(farm.gstin) !== gstinState(profile.gstin) } : null}
      />
    </div>
  )
}
