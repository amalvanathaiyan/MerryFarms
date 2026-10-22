import Link from "next/link"
import { ArrowLeft, Sprout, UserRound } from "lucide-react"
import { LanguageToggle } from "@/components/language-toggle"

/**
 * The farm's banner, fixed at the top of every customer page. The name gets almost the
 * whole width (Tamil names run long) and wraps rather than being cut; the actions are
 * small round icons so they never crowd it out.
 */
export function FarmBanner({
  name,
  initials,
  href = "/",
  back,
  myOrders,
}: {
  name: string
  initials: string
  /** Where tapping the name goes. */
  href?: string
  /** Shows a back arrow (label for screen readers). */
  back?: string
  myOrders?: { href: string; label: string }
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-header text-header-foreground shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3" aria-label={back}>
          {back ? (
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
              {initials}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="text-lg font-bold leading-tight break-words">{name}</span>
            {/* The platform's own mark, quieter than the farm's name. */}
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium tracking-wide opacity-70" lang="en">
              <Sprout className="size-3.5" aria-hidden />
              FarmForYou
            </span>
          </span>
        </Link>
        {myOrders && (
          <Link href={myOrders.href} className="grid size-10 shrink-0 place-items-center rounded-full border bg-card text-card-foreground" aria-label={myOrders.label} title={myOrders.label}>
            <UserRound className="size-5" aria-hidden />
          </Link>
        )}
        <LanguageToggle variant="icon" />
      </div>
    </header>
  )
}
