import { cn } from "@/lib/utils"

const STYLE: Record<string, string> = {
  applied: "bg-yolk text-yolk-foreground",
  reviewing: "bg-accent text-accent-foreground",
  needs_info: "bg-yolk text-yolk-foreground",
  on_hold: "bg-muted text-muted-foreground",
  approved: "bg-primary text-primary-foreground",
  rejected: "bg-destructive/15 text-destructive",
}

/** Where a farm's application is: new, being checked, waiting for details, on hold, approved or turned down. */
export function ApplicationBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold", STYLE[status] ?? "bg-muted")}>{label}</span>
}
