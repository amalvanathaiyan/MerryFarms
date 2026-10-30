import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ExternalLink, Plus } from "lucide-react"
import { listFarms } from "@/server/platform"
import { statusLabel } from "@/domain/tenants"
import { formatRupees } from "@/domain/money"
import { pick } from "@/lib/i18n-helpers"
import { farmUrl } from "@/lib/farm-url"
import { Button } from "@/components/ui/button"
import { FarmMark, StatusBadge } from "./farm-bits"

/** Every farm on the platform: how many are on trial or paused, and how each is doing this month. */
export default async function AdminHome() {
  const t = await getTranslations("admin")
  const locale = await getLocale()
  const now = new Date()
  const farms = await listFarms(now)
  const day = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
  const labels = farms.map((f) => statusLabel(f.status, f.trialEndsAt, now))
  const tiles = [
    { label: t("farmsTotal"), value: farms.length },
    { label: t("status_trial"), value: labels.filter((l) => l === "trial").length },
    { label: t("status_trial_over"), value: labels.filter((l) => l === "trial_over").length, warn: true },
    { label: t("status_suspended"), value: labels.filter((l) => l === "suspended").length },
    { label: t("orders30"), value: farms.reduce((a, f) => a + f.orders30, 0) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{t("farms")}</h1>
        <Button asChild size="lg" className="h-12 bg-sun text-base text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
          <Link href="/admin/farms/new">
            <Plus /> {t("newFarm")}
          </Link>
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label={t("summary")}>
        {tiles.map((x) => (
          <div key={x.label} className={x.warn && x.value > 0 ? "rounded-2xl bg-yolk p-4 text-yolk-foreground" : "rounded-2xl border bg-card p-4"}>
            <div className="text-sm">{x.label}</div>
            <div className="font-display text-3xl font-bold tabular-nums">{x.value}</div>
          </div>
        ))}
      </section>

      {farms.length === 0 && <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("noFarms")}</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {farms.map((f, i) => {
          const shop = farmUrl(f.slug)
          return (
            <li key={f.id} className="flex flex-col gap-3 rounded-3xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <FarmMark logoUrl={f.logoUrl} initials={f.invoicePrefix} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/admin/farms/${f.id}`} className="font-display text-lg font-bold leading-snug hover:underline">
                    {pick(locale, f.nameTa, f.nameEn)}
                  </Link>
                  <span className="text-sm text-muted-foreground" lang="en">
                    {f.slug} · {f.phone}
                  </span>
                </div>
                <StatusBadge status={labels[i]} label={t(`status_${labels[i]}`)} />
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-accent px-2.5 py-0.5 font-medium">{t(`plan_${f.plan}`)}</span>
                {f.status === "trial" && f.trialEndsAt && <span className="rounded-full border px-2.5 py-0.5">{t("trialEnds", { date: day.format(f.trialEndsAt) })}</span>}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("orders30")}</dt>
                  <dd className="font-semibold tabular-nums">{f.orders30}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("sales30")}</dt>
                  <dd className="font-semibold tabular-nums">{formatRupees(f.sales30Paise)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("customers")}</dt>
                  <dd className="font-semibold tabular-nums">{f.customers}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("lastOrder")}</dt>
                  <dd className="font-semibold">{f.lastOrderAt ? day.format(f.lastOrderAt) : "—"}</dd>
                </div>
              </dl>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href={`/admin/farms/${f.id}`}>{t("manage")}</Link>
                </Button>
                {shop && (
                  <Button asChild variant="ghost">
                    <a href={shop} target="_blank" rel="noreferrer">
                      <ExternalLink /> {t("openShop")}
                    </a>
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
