import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, ExternalLink, Plus } from "lucide-react"
import { istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { invoiceState } from "@/domain/platform-billing"
import { farmInvoices } from "@/server/platform-billing"
import { InvoiceBadge } from "@/components/invoice-badge"
import { farmDetail } from "@/server/platform"
import { statusLabel } from "@/domain/tenants"
import { pick } from "@/lib/i18n-helpers"
import { farmLogoUrl, farmUrl } from "@/lib/farm-url"
import { Button } from "@/components/ui/button"
import { FarmMark, StatusBadge } from "../../farm-bits"
import { EditFarmForm, OwnerForm, StaffRow } from "./farm-forms"
import { SupportForm } from "./support-form"
import { SupportLog } from "@/components/farm/support-log"
import { prisma } from "@/lib/prisma"
import { parseEntitlement } from "@/domain/entitlements"
import { SubscriptionForm } from "./subscription-form"

/** One farm: change its plan, trial, status and details; help its staff back in. */
export default async function FarmAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await farmDetail(id)
  if (!detail) notFound()
  const { farm, staff, counts, videoBytes } = detail
  const t = await getTranslations("admin")
  const tr = await getTranslations("farm.staff")
  const locale = await getLocale()
  const label = statusLabel(farm.status, farm.trialEndsAt, new Date())
  const shop = farmUrl(farm.slug)
  const hasOwner = staff.some((s) => s.isActive && s.roles.includes("owner"))
  const ts = await getTranslations("admin.subscription")
  const tb = await getTranslations("admin.billing")
  const today = istDate(new Date())
  const [sub, plans, row, bills] = await Promise.all([
    prisma.farmSubscription.findUnique({ where: { tenantId: farm.id } }),
    prisma.platformPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { version: "desc" }] }),
    prisma.tenant.findUnique({ where: { id: farm.id }, select: { entitlements: true } }),
    farmInvoices(farm.id, 3),
  ])
  const ent = parseEntitlement(row?.entitlements)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/admin/farms" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {t("farms")}
      </Link>

      <section className="flex flex-wrap items-center gap-4">
        <FarmMark logoUrl={farmLogoUrl(farm.slug, farm.logoUrl)} initials={farm.invoicePrefix} className="size-16" />
        <div className="flex min-w-[12rem] flex-1 flex-col">
          <h1 className="text-2xl font-bold">{pick(locale, farm.nameTa, farm.nameEn)}</h1>
          <span className="text-sm text-muted-foreground" lang="en">
            {farm.slug} · {farm.phone}
          </span>
        </div>
        <StatusBadge status={label} label={t(`status_${label}`)} />
      </section>

      <div className="flex flex-wrap gap-2">
        {shop && (
          <Button asChild variant="outline">
            <a href={shop} target="_blank" rel="noreferrer">
              <ExternalLink /> {t("openShop")}
            </a>
          </Button>
        )}
      </div>

      {/* Into the farm's app as FarmForYou support: with a reason, for an hour, every change logged for the farm. */}
      <SupportForm tenantId={farm.id} />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [t("products"), counts.products],
          [t("customers"), counts.customers],
          [t("ordersAll"), counts.orders],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-3">
            <dt className="text-xs text-muted-foreground wrap-anywhere sm:text-sm">{k}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-bold">{ts("title")}</h2>
        <SubscriptionForm
          tenantId={farm.id}
          // A farm already on a retired version still sees it; otherwise only plans on offer
          plans={plans.filter((p) => !p.retired || p.id === sub?.planId).map((p) => ({ id: p.id, label: `${pick(locale, p.nameTa, p.nameEn)} · v${p.version}${p.retired ? " ✕" : ""}`, modules: p.modules, retired: p.retired }))}
          modulesNow={ent?.modules ?? []}
          initial={
            sub
              ? {
                  planId: sub.planId,
                  status: sub.status as "trial",
                  billingCycle: sub.billingCycle === "yearly" ? "yearly" : "monthly",
                  trialEndsOn: sub.trialEndsAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(sub.trialEndsAt) : null,
                  addOns: sub.addOns,
                  moduleOverrides: (sub.moduleOverrides ?? {}) as Record<string, boolean>,
                  priceOverrideRupees: sub.priceOverridePaise === null ? null : sub.priceOverridePaise / 100,
                  notes: sub.notes ?? "",
                }
              : null
          }
        />
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{tb("title")}</h2>
          <Button asChild variant="outline">
            <Link href={`/admin/billing/new?farm=${farm.id}`}>
              <Plus /> {tb("newInvoice")}
            </Link>
          </Button>
        </div>
        {bills.invoices.length === 0 ? (
          <p className="text-muted-foreground">{tb("noInvoicesFarm")}</p>
        ) : (
          <>
            <p className={bills.owedPaise > 0 ? "font-semibold" : "text-muted-foreground"}>{bills.owedPaise > 0 ? tb("farmOwes", { amount: formatRupees(bills.owedPaise) }) : tb("nothingOwedFarm")}</p>
            <ul className="flex flex-col divide-y text-sm">
              {bills.invoices.map((i) => ({ ...i, state: invoiceState(i, today) })).map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/billing/${i.id}`} className="flex min-h-11 items-center justify-between gap-3 py-1.5 hover:text-primary">
                    <span className="tabular-nums">
                      {i.number} · <b>{formatRupees(i.totalPaise)}</b>
                    </span>
                    <InvoiceBadge state={i.state} label={tb(`state_${i.state}`)} />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/admin/billing?farm=${farm.id}`} className="self-start text-sm font-semibold text-primary underline underline-offset-4">
              {tb("allInvoicesFarm")}
            </Link>
          </>
        )}
      </section>

      <EditFarmForm
        farm={{
          id: farm.id,
          nameTa: farm.nameTa,
          nameEn: farm.nameEn,
          phone: farm.phone,
          invoicePrefix: farm.invoicePrefix,
          defaultLanguage: farm.defaultLanguage,
          plan: farm.plan,
          status: farm.status,
          trialEndsOn: farm.trialEndsAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(farm.trialEndsAt) : null,
          videoSpaceMb: farm.videoSpaceMb,
          openingMark: farm.openingMark,
        }}
        videoUsedMb={Math.round((videoBytes / 1024 / 1024) * 10) / 10}
      />

      <SupportLog tenantId={farm.id} forAdmin />

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-bold">{t("staff")}</h2>
        {!hasOwner && <p className="rounded-xl bg-yolk p-3 text-sm font-medium text-yolk-foreground">{t("noOwner")}</p>}
        <ul className="flex flex-col divide-y">
          {staff.map((s) => (
            <StaffRow
              key={s.id}
              tenantId={farm.id}
              staff={{ id: s.id, name: s.name, email: s.email, active: s.isActive, roles: s.roles.map((r) => (tr.has(`role_${r}`) ? tr(`role_${r}`) : r)).join(", ") }}
            />
          ))}
        </ul>
        <OwnerForm tenantId={farm.id} />
      </section>
    </div>
  )
}
