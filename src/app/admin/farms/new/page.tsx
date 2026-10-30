import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { NewFarmForm } from "./new-farm-form"

export default async function NewFarmPage() {
  const t = await getTranslations("admin")
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link href="/admin" className="flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1.5 text-sm font-semibold">
        <ArrowLeft className="size-4" aria-hidden /> {t("farms")}
      </Link>
      <h1 className="text-2xl font-bold">{t("newFarm")}</h1>
      <NewFarmForm rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? null} />
    </div>
  )
}
