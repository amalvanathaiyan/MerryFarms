import type { InvoiceState } from "@/domain/platform-billing"
import { cn } from "@/lib/utils"

const STYLE: Record<InvoiceState, string> = {
  due: "bg-yolk text-yolk-foreground",
  overdue: "bg-destructive text-white",
  paid: "bg-accent text-primary",
  void: "bg-muted text-muted-foreground line-through",
}

/** An invoice's state in words, coloured: due, overdue, paid or cancelled. */
export function InvoiceBadge({ state, label, className }: { state: InvoiceState; label: string; className?: string }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STYLE[state], className)}>{label}</span>
}
