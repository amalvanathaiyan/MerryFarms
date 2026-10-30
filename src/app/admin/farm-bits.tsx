import { cn } from "@/lib/utils"

/** A farm's logo, or its bill-prefix initials on leaf green until it adds one. */
export function FarmMark({ logoUrl, initials, className }: { logoUrl: string | null; initials: string; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- small logos served by our own route
    return <img src={logoUrl} alt="" className={cn("size-12 shrink-0 rounded-2xl border bg-card object-contain", className)} />
  }
  return (
    <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground", className)} aria-hidden>
      {initials}
    </span>
  )
}

const STATUS_STYLE = {
  trial: "bg-accent text-accent-foreground",
  trial_over: "bg-yolk text-yolk-foreground",
  active: "bg-primary text-primary-foreground",
  suspended: "bg-destructive/15 text-destructive",
} as const

export function StatusBadge({ status, label }: { status: keyof typeof STATUS_STYLE; label: string }) {
  return <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold", STATUS_STYLE[status])}>{label}</span>
}
