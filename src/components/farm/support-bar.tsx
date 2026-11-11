import { getLocale, getTranslations } from "next-intl/server"
import { LifeBuoy, LogOut } from "lucide-react"
import { endSupportAction } from "@/app/actions/support"

/**
 * Across the top of the farm app during a support visit, in FarmForYou's dark colour so it is never mistaken for
 * the farm's own login: whose farm, until when, and Exit. (Colours inline: arbitrary Tailwind colours don't always build.)
 */
export async function SupportBar({ farm, endsAt }: { farm: string; endsAt: Date }) {
  const t = await getTranslations("farm.support")
  const locale = await getLocale()
  const until = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(endsAt)
  return (
    <div className="print:hidden" style={{ background: "#16301F", color: "#FFF6DE" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-sm leading-snug font-medium">
          <LifeBuoy className="size-4 shrink-0" aria-hidden />
          <span>{t("bar", { farm, until })}</span>
        </p>
        <form action={endSupportAction}>
          <button type="submit" className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold"
            style={{ background: "#FFF6DE", color: "#16301F" }}>
            <LogOut className="size-4" aria-hidden /> {t("exit")}
          </button>
        </form>
      </div>
    </div>
  )
}
