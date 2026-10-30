import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { farmDetail } from "@/server/platform"
import { statusLabel } from "@/domain/tenants"
import { pick } from "@/lib/i18n-helpers"
import { farmUrl } from "@/lib/farm-url"
import { Button } from "@/components/ui/button"
import { FarmMark, StatusBadge } from "../../farm-bits"
import { EditFarmForm, OwnerForm, StaffRow } from "./farm-forms"

/** One farm: change its plan, trial, status and details; help its staff back in. */
export default async function FarmAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await farmDetail(id)
  if (!detail) notFound()
  const { farm, staff, counts } = detail
  const t = await getTranslations("admin")
  const tr = await getTranslations("farm.staff")
  const locale = await getLocale()
  const label = statusLabel(farm.status, farm.trialEndsAt, new Date())
  const shop = farmUrl(farm.slug)
  const app = farmUrl(farm.slug, "/login")
  const hasOwner = staff.some((s) => s.isActive && s.roles.includes("owner"))

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href="/admin" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {t("farms")}
      </Link>

      <section className="flex flex-wrap items-center gap-4">
        <FarmMark logoUrl={farm.logoUrl} initials={farm.invoicePrefix} className="size-16" />
        <div className="flex min-w-0 flex-1 flex-col">
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
        {app && (
          <Button asChild variant="outline">
            <a href={app} target="_blank" rel="noreferrer">
              <ExternalLink /> {t("openFarmApp")}
            </a>
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          [t("products"), counts.products],
          [t("customers"), counts.customers],
          [t("ordersAll"), counts.orders],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-3">
            <dt className="text-sm text-muted-foreground">{k}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

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
        }}
      />

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
