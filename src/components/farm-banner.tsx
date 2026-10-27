import Link from "next/link"
import { ArrowLeft, UserRound } from "lucide-react"
import { LanguageToggle } from "@/components/language-toggle"
import { WheelMark } from "@/components/art/wheel-mark"
import { HelpButton } from "@/components/shop/help-button"

/**
 * The farm's banner, fixed at the top of every customer page. The name gets almost the whole width
 * (Tamil names run long) and wraps rather than being cut. Every action carries a word, not just an
 * icon, for people new to apps. With `help`, the page also gets the "Help" button (call / WhatsApp / how to order).
 */
export function FarmBanner({
  name,
  initials,
  href = "/",
  back,
  myOrders,
  help,
}: {
  name: string
  initials: string
  /** Where tapping the name goes. */
  href?: string
  /** Shows a back arrow with this word beside it ("பின்"). */
  back?: string
  myOrders?: { href: string; label: string; shortLabel: string }
  help?: { phone: string; whatsappNumber: string; basket?: string[]; raised?: boolean }
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-header/95 text-header-foreground backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 xs:gap-3 sm:px-6">
          <Link href={href} className="flex min-w-0 flex-1 items-center gap-2 xs:gap-3">
            {back ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border bg-card px-2.5 py-1.5 text-sm font-semibold text-card-foreground">
                <ArrowLeft className="size-4" aria-hidden />
                {back}
              </span>
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground xs:size-11 xs:rounded-2xl xs:text-sm" aria-hidden>
                {initials}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="font-display text-base font-bold leading-tight break-words xs:text-lg sm:text-xl">{name}</span>
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
              className="flex h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border bg-card px-1.5 text-[11px] leading-none font-semibold xs:min-w-14 xs:px-2 text-card-foreground transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-primary hover:bg-accent hover:text-primary hover:shadow-md active:scale-95"
              title={myOrders.label}
            >
              <UserRound className="size-5" aria-hidden />
              <span>
                {myOrders.shortLabel}
                <span className="sr-only"> · {myOrders.label}</span>
              </span>
            </Link>
          )}
          <LanguageToggle compact />
        </div>
      </header>
      {help && <HelpButton {...help} />}
    </>
  )
}
