import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronRight, Plus } from "lucide-react"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"
import { istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { invoiceState, type InvoiceState } from "@/domain/platform-billing"
import { billingProfile, listInvoices } from "@/server/platform-billing"
import { Button } from "@/components/ui/button"
import { BillingProfileForm } from "./billing-profile-form"
import { InvoiceBadge } from "@/components/invoice-badge"

const SHOWS = ["all", "overdue", "due", "paid", "void"] as const
type Show = (typeof SHOWS)[number]

/**
 * Admin · Billing: what farms owe, every invoice (filtered by state, or by one farm), and the one place to make an
 * invoice. Farm For You's billing details and the GST switch are folded at the bottom: set once, rarely changed.
 */
export default async function AdminBillingPage({ searchParams }: { searchParams: Promise<{ show?: string; farm?: string }> }) {
  const sp = await searchParams
  const show: Show = SHOWS.find((s) => s === sp.show) ?? "all"
  const t = await getTranslations("admin.billing")
  const locale = await getLocale()
  const today = istDate(new Date())
  const [all, profile] = await Promise.all([listInvoices(), billingProfile()])
  const rows = all.filter((r) => !sp.farm || r.tenant.id === sp.farm).map((r) => ({ ...r, state: invoiceState(r, today) }))
  const matches = (r: (typeof rows)[number], s: Show) => s === "all" || r.state === s
  const counts = Object.fromEntries(SHOWS.map((s) => [s, rows.filter((r) => matches(r, s)).length])) as Record<Show, number>
  const shown = rows.filter((r) => matches(r, show))
  const owed = rows.reduce((a, r) => a + r.leftPaise, 0)
  const farm = sp.farm ? rows[0]?.tenant : null
  const date = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const fmt = (d: string) => date.format(new Date(`${d}T00:00:00Z`))
  const href = (s: Show) => {
    const q = new URLSearchParams({ ...(s !== "all" ? { show: s } : {}), ...(sp.farm ? { farm: sp.farm } : {}) }).toString()
    return q ? `/admin/billing?${q}` : "/admin/billing"
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{owed > 0 ? t("owed", { amount: formatRupees(owed) }) : t("nothingOwed")}</p>
        </div>
        <Button asChild size="lg" className="h-12 bg-sun text-base text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
          <Link href={sp.farm ? `/admin/billing/new?farm=${sp.farm}` : "/admin/billing/new"}>
            <Plus /> {t("newInvoice")}
          </Link>
        </Button>
      </div>

      {sp.farm && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {t("onlyFarm", { farm: farm ? pick(locale, farm.nameTa, farm.nameEn) : "—" })}
          <Link href="/admin/billing" className="font-semibold text-primary underline underline-offset-4">
            {t("allFarms")}
          </Link>
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noInvoices")}</p>
      ) : (
        <>
          <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
            {SHOWS.filter((s) => s === "all" || s === show || counts[s] > 0).map((s) => (
              <Link
                key={s}
                href={href(s)}
                aria-current={s === show ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold",
                  s === show ? "border-primary bg-primary text-primary-foreground" : s === "overdue" ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-card hover:border-primary"
                )}
              >
                {t(`show_${s}`)} <span className="tabular-nums">{counts[s]}</span>
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noneHere")}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-2xl border bg-card">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/billing/${r.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{pick(locale, r.tenant.nameTa, r.tenant.nameEn)}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {r.number} · {r.state === "due" || r.state === "overdue" ? t("payBy", { date: fmt(r.dueOn) }) : fmt(r.issuedOn)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{formatRupees(r.totalPaise)}</span>
                      <InvoiceBadge state={r.state as InvoiceState} label={r.paidPaise > 0 && r.leftPaise > 0 ? t("left", { amount: formatRupees(r.leftPaise) }) : t(`state_${r.state}`)} />
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <details className="group rounded-2xl border bg-card p-4" open={!profile.upiId && !profile.bank ? true : undefined}>
        <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-bold">{t("profileTitle")}</span>
          <span className={cn("rounded-full px-3 py-0.5 text-sm font-semibold", profile.gstOn ? "bg-primary text-primary-foreground" : "bg-muted")}>{profile.gstOn ? t("gstOnShort", { rate: profile.gstRatePct }) : t("gstOffShort")}</span>
        </summary>
        <div className="mt-3">
          <BillingProfileForm initial={profile} />
        </div>
      </details>
    </div>
  )
}
