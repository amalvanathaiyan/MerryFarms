import { Clock } from "lucide-react"
import type { WaitLevel } from "@/domain/automations"

/**
 * How long an order has waited to be confirmed: green, then yellow, then red (the farm's own hours, Settings →
 * Automations), always with the time in words beside it, never colour alone. Colours in globals.css (.wait-*).
 */
export function WaitBadge({ level, text }: { level: WaitLevel; text: string }) {
  return (
    <span className={`wait-badge wait-${level} inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold`}>
      <Clock className="size-3.5" aria-hidden />
      {text}
    </span>
  )
}
