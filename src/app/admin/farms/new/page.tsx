import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { applicationDetail } from "@/server/applications"
import { applicationNumber, isOpen } from "@/domain/applications"
import { NewFarmForm, type FromApplication } from "./new-farm-form"

/** Admin · New farm. With ?from=<application>, filled in from a farm's application; adding it approves that. */
export default async function NewFarmPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const t = await getTranslations("admin")
  const id = (await searchParams).from
  const a = id ? await applicationDetail(id) : null
  const from: FromApplication | undefined =
    a && isOpen(a.status)
      ? { id: a.id, nameTa: a.nameTa, nameEn: a.nameEn ?? "", phone: a.phone, language: a.language === "en" ? "en" : "ta", ownerName: a.ownerName, ownerEmail: a.email, trialDays: a.plan?.trialDays ?? null }
      : undefined
  const back = from ? { href: `/admin/farms/applications/${from.id}`, label: applicationNumber(a!.number) } : { href: "/admin/farms", label: t("farms") }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link href={back.href} className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {back.label}
      </Link>
      <h1 className="text-2xl font-bold">{t("newFarm")}</h1>
      {from && <p className="rounded-2xl bg-accent p-3 text-sm font-medium">{t("join.fromApplication")}</p>}
      <NewFarmForm rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? null} from={from} />
    </div>
  )
}
