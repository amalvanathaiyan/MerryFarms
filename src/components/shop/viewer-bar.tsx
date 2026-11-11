import { getTranslations } from "next-intl/server"
import { ArrowLeft } from "lucide-react"
import { adminUrl } from "@/lib/farm-url"

/**
 * Across the top of the shop, only for the farm's own staff or the FarmForYou super admin: what they are looking
 * at, and one tap back to their own app. Customers never see it. It also helps an owner who installed the shop
 * by mistake find the farm app.
 */
export async function ViewerBar({ viewer }: { viewer: "staff" | "admin" }) {
  const t = await getTranslations("shop.viewer")
  const back = viewer === "admin" ? adminUrl() : "/farm"
  return (
    <div className="bg-primary text-primary-foreground print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
        <p className="min-w-0 flex-1 text-sm leading-snug font-medium">{t(viewer === "admin" ? "admin" : "staff")}</p>
        <a href={back} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary-foreground px-3.5 text-sm font-bold text-primary">
          <ArrowLeft className="size-4" aria-hidden /> {t(viewer === "admin" ? "backAdmin" : "backFarm")}
        </a>
      </div>
    </div>
  )
}
