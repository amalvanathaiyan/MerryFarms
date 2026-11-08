import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Eye, LogOut } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { moreTiles, SECTION_LOOK } from "@/lib/farm-sections"
import { signOut } from "@/app/actions/auth"
import { SectionHeader } from "@/components/farm/section-header"
import { SectionIcon } from "@/components/farm/section-icon"
import { cn } from "@/lib/utils"
import { InstallApp } from "@/components/install-app"

/** Everything that isn't a daily job, as big coloured tiles: one picture, one word, one line of help. */
export default async function MorePage() {
  const { tenant, staff, db } = await requireStaff()
  const t = await getTranslations("farm.sections")
  const tm = await getTranslations("farm.more")
  const features = featuresOf(tenant)
  const tiles = moreTiles({ roles: staff.roles, features })
  const unread = features.messages ? await db.message.count({ where: { sender: "customer", seenAt: null } }) : 0

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="more" />
      <ul className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const look = SECTION_LOOK[tile.key]
          const badge = tile.key === "messages" ? unread : 0
          return (
            <li key={tile.key}>
              <Link href={tile.href} className={cn("relative flex h-full min-h-28 flex-col gap-1.5 rounded-2xl p-3 transition-transform active:scale-[0.98]", look.tint)}>
                <span className={cn("grid size-11 place-items-center rounded-full", look.strong)}>
                  <SectionIcon name={tile.key} className="size-6" />
                </span>
                <span className="text-lg leading-tight font-bold">{t(`${tile.key}.title`)}</span>
                <span className="text-sm leading-snug text-muted-foreground">{badge > 0 ? tm("newMessages", { count: badge }) : t(`${tile.key}.hint`)}</span>
                {badge > 0 && <span className="absolute top-3 right-3 min-w-6 rounded-full bg-destructive px-1.5 text-center text-xs leading-6 font-bold text-destructive-foreground tabular-nums">{badge}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
      <Link href="/farm/account#display" className="flex items-center gap-3 rounded-2xl border-2 bg-card p-3 hover:bg-accent">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-primary">
          <Eye className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg leading-tight font-bold">{tm("display")}</span>
          <span className="block text-sm text-muted-foreground">{tm("displayHint")}</span>
        </span>
        <span aria-hidden>→</span>
      </Link>
      <InstallApp variant="panel" />
      <form action={signOut}>
        <button type="submit" className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive/30 bg-card text-base font-bold text-destructive hover:bg-destructive/10">
          <LogOut className="size-5" aria-hidden /> {tm("signOut")}
        </button>
      </form>
    </div>
  )
}
