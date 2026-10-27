import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { inbox } from "@/server/chat"
import { chatTime, hoursSince } from "@/lib/chat-time"
import { cn } from "@/lib/utils"

/** Every conversation, newest first; unread and long-waiting ones stand out. */
export default async function FarmMessagesPage() {
  const { tenant } = await requireStaff()
  requireFeature(tenant, "messages")
  const locale = await getLocale()
  const t = await getTranslations("chat")
  const rows = await inbox(tenant.id)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {rows.length === 0 && <p className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">{t("inboxEmpty")}</p>}
      <ul className="divide-y rounded-2xl border bg-card">
        {rows.map((r) => {
          const waitingH = r.waitingSince ? hoursSince(r.waitingSince) : 0
          return (
            <li key={r.customerId}>
              <Link href={`/farm/messages/${r.customerId}`} className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className={cn("truncate", r.unread ? "font-bold" : "font-semibold")}>{r.customerName}</div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {r.last.sender === "farm" && `${t("you")}: `}
                    {r.last.body}
                  </p>
                  {r.waitingSince && waitingH >= 2 && <p className="mt-1 text-xs font-semibold text-destructive">{t("waitingHours", { hours: Math.floor(waitingH) })}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground tabular-nums">{chatTime(r.last.at, locale)}</span>
                  {r.unread > 0 && <span className="min-w-6 rounded-full bg-destructive px-1.5 text-center text-xs font-bold leading-6 text-destructive-foreground tabular-nums">{r.unread}</span>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
