import Link from "next/link"
import { ArrowLeft, UserRound } from "lucide-react"
import { LanguageToggle } from "@/components/language-toggle"
import { WheelMark } from "@/components/art/wheel-mark"

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
    <header className="sticky top-0 z-20 border-b bg-header/95 text-header-foreground backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3" aria-label={back}>
          {back ? (
            <ArrowLeft className="size-5 shrink-0" aria-hidden />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
              {initials}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-lg font-bold leading-tight break-words sm:text-xl">{name}</span>
            {/* The platform's own mark (the cart wheel), quieter than the farm's name. */}
            <span className="mt-0.5 flex items-center gap-1 text-xs font-medium tracking-wide opacity-75" lang="en">
              <WheelMark className="size-4 text-primary" />
              FarmForYou
            </span>
          </span>
        </Link>
        {myOrders && (
          <Link
            href={myOrders.href}
            className="grid size-10 shrink-0 place-items-center rounded-full border bg-card text-card-foreground transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-primary hover:bg-accent hover:text-primary hover:shadow-md active:scale-95"
            aria-label={myOrders.label}
            title={myOrders.label}
          >
            <UserRound className="size-5" aria-hidden />
          </Link>
        )}
        <LanguageToggle variant="icon" />
      </div>
    </header>
  )
}
