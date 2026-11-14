import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { MODULE_KEYS, MODULES } from "@/domain/modules"
import { JoinForm } from "./join-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join")
  return { title: `${t("title")} · Farm For You` }
}

/** Register your farm: the form, with the public plans to pick from (?plan= from the home page's plan cards). */
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const t = await getTranslations("join")
  const tm = await getTranslations("modules")
  const th = await getTranslations("home")
  const locale = await getLocale()
  const wanted = (await searchParams).plan
  const plans = await prisma.platformPlan.findMany({ where: { isPublic: true, retired: false }, orderBy: [{ sortOrder: "asc" }, { monthlyPaise: "asc" }] })
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>
      <JoinForm
        language={locale === "en" ? "en" : "ta"}
        modules={MODULE_KEYS.filter((k) => k !== "core").map((k) => ({ key: k, name: tm(k), soon: !MODULES[k].available }))}
        plans={plans.map((p) => ({ id: p.id, name: pick(locale, p.nameTa, p.nameEn), price: p.monthlyPaise > 0 ? `${formatRupees(p.monthlyPaise)} ${th("perMonth")}` : th("free") }))}
        initialPlan={plans.some((p) => p.id === wanted) ? wanted! : null}
      />
    </div>
  )
}
