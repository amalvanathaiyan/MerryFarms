import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ArrowRight, Check, ChevronDown, Egg, Fish, Milk, PhoneCall, Sprout, Store, Tractor, Truck, ClipboardCheck, type LucideIcon } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { farmLogoUrl, farmUrl } from "@/lib/farm-url"
import { formatRupees } from "@/domain/money"
import { MODULE_KEYS, MODULES, isModuleKey, type ModuleKey } from "@/domain/modules"
import { Button } from "@/components/ui/button"
import { FfyMark } from "@/components/art/brand-mark"
import { FarmMark } from "@/app/admin/farm-bits"

const ICONS: Record<ModuleKey, LucideIcon> = { core: Tractor, selling: Store, buying: Truck, poultry: Egg, livestock: Milk, fishery: Fish, crops: Sprout }
const FAQ = ["cost", "phone", "tamil", "customers", "data"] as const

/**
 * Farm For You's home page (the portal's "/"), Tamil first, read top to bottom:
 *   what it is and one button to register; what it does (modules, "coming soon" for those not built);
 *   plans and prices, live from admin; how joining works; farms already on it; questions.
 * Each plan's button opens the registration with that plan chosen, so nothing is asked twice.
 */
export default async function HomePage() {
  const t = await getTranslations("home")
  const tm = await getTranslations("modules")
  const locale = await getLocale()
  const [plans, farms] = await Promise.all([
    prisma.platformPlan.findMany({ where: { isPublic: true, retired: false }, orderBy: [{ sortOrder: "asc" }, { monthlyPaise: "asc" }] }),
    prisma.tenant.findMany({ where: { status: { not: "suspended" } }, orderBy: { createdAt: "asc" }, take: 12, select: { slug: true, nameTa: true, nameEn: true, logoUrl: true, taglineTa: true, taglineEn: true, invoicePrefix: true } }),
  ])
  const modules = MODULE_KEYS.filter((k) => k !== "core")

  return (
    <div className="flex flex-col">
      {/* 1. What it is */}
      <section className="bg-accent/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-4 py-10 sm:flex-row sm:items-center sm:px-6 sm:py-14">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h1 className="font-display text-3xl leading-tight font-bold text-balance sm:text-5xl">{t("heroTitle")}</h1>
            <p className="max-w-xl text-lg text-pretty">{t("heroText")}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg" className="h-auto min-h-14 bg-sun px-6 py-2 text-lg whitespace-normal text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
                <Link href="/join">
                  {t("register")} <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-14 px-6 text-lg">
                <a href="#plans">
                  {t("seePlans")} <ChevronDown aria-hidden />
                </a>
              </Button>
            </div>
          </div>
          <FfyMark className="size-36 self-center sm:size-56" />
        </div>
      </section>

      {/* 2. What it does */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("modulesTitle")}</h2>
        <p className="-mt-2 text-muted-foreground">{t("modulesText")}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((k) => {
            const Icon = ICONS[k]
            const soon = !MODULES[k].available
            return (
              <li key={k} className="flex gap-3 rounded-2xl border bg-card p-4">
                <span className={soon ? "grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground" : "grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-x-2 font-bold">
                    {tm(k)}
                    {soon && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{t("soon")}</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground">{t(`module_${k}`)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 3. Plans, live from admin */}
      <section id="plans" className="scroll-mt-20 bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("plansTitle")}</h2>
          {plans.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-5 text-muted-foreground">{t("plansSoon")}</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <li key={p.id} className="flex flex-col gap-3 rounded-3xl border-2 bg-background p-5">
                  <div>
                    <h3 className="text-xl font-bold">{pick(locale, p.nameTa, p.nameEn)}</h3>
                    {pick(locale, p.descriptionTa, p.descriptionEn) && <p className="text-sm text-muted-foreground">{pick(locale, p.descriptionTa, p.descriptionEn)}</p>}
                  </div>
                  <p>
                    <span className="font-display text-3xl font-bold tabular-nums">{p.monthlyPaise > 0 ? formatRupees(p.monthlyPaise) : t("free")}</span>
                    {p.monthlyPaise > 0 && <span className="text-muted-foreground"> {t("perMonth")}</span>}
                  </p>
                  {p.trialDays > 0 && p.monthlyPaise > 0 && <p className="-mt-2 text-sm font-semibold text-primary">{t("trial", { days: p.trialDays })}</p>}
                  <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                    {["core", ...p.modules.filter((m) => m !== "core")].filter(isModuleKey).map((m) => (
                      <li key={m} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-primary" aria-hidden /> {tm(m)}
                      </li>
                    ))}
                  </ul>
                  <Button asChild size="lg" className="h-12 text-base">
                    <Link href={`/join?plan=${p.id}`}>{t("choosePlan")}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 4. How joining works */}
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("stepsTitle")}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {([ClipboardCheck, PhoneCall, Store] as const).map((Icon, i) => (
            <li key={i} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
              <span className="flex items-center gap-2 font-bold">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground tabular-nums">{i + 1}</span>
                <Icon className="size-5 text-primary" aria-hidden />
                {t(`step${i + 1}Title`)}
              </span>
              <p className="text-sm text-muted-foreground">{t(`step${i + 1}Text`)}</p>
            </li>
          ))}
        </ol>
        <Button asChild size="lg" className="h-auto min-h-14 self-start bg-sun px-6 py-2 text-lg whitespace-normal text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
          <Link href="/join">
            {t("register")} <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>

      {/* 5. Farms on Farm For You */}
      {farms.length > 0 && (
        <section className="bg-card">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 sm:px-6">
            <h2 className="text-2xl font-bold sm:text-3xl">{t("farmsTitle")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {farms.map((f) => (
                <li key={f.slug}>
                  <a href={farmUrl(f.slug)} className="flex min-h-20 items-center gap-3 rounded-2xl border bg-background p-3 hover:border-primary">
                    <FarmMark logoUrl={farmLogoUrl(f.slug, f.logoUrl)} initials={f.invoicePrefix} />
                    <span className="min-w-0">
                      <span className="block font-bold">{pick(locale, f.nameTa, f.nameEn)}</span>
                      {pick(locale, f.taglineTa, f.taglineEn) && <span className="block truncate text-sm text-muted-foreground">{pick(locale, f.taglineTa, f.taglineEn)}</span>}
                      <span className="text-sm font-semibold text-primary">{t("visitShop")}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 6. Questions */}
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-10 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("faqTitle")}</h2>
        {FAQ.map((q) => (
          <details key={q} className="group rounded-2xl border bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
              {t(`faq_${q}_q`)}
              <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-4 pb-4 text-muted-foreground">{t(`faq_${q}_a`)}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
