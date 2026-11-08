"use client"

import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const asNumber = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0)
const round = (n: number) => Math.round(n * 10) / 10

/**
 * A number with big − and + buttons either side, for counting on a phone without the keyboard (typing still works).
 * The value stays a string so an empty box means "not entered".
 */
export function NumberStepper({
  label,
  value,
  onChange,
  step = 1,
  decimal = false,
  size = "lg",
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  step?: number
  decimal?: boolean
  size?: "lg" | "sm"
  className?: string
}) {
  const n = asNumber(value)
  const btn = cn(
    "grid shrink-0 place-items-center rounded-xl border-2 bg-card text-foreground transition-colors active:scale-95 disabled:opacity-40",
    size === "lg" ? "size-12" : "size-10"
  )
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className={cn("font-semibold", size === "lg" ? "text-sm" : "text-xs")}>{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} aria-label={`${label} −${step}`} disabled={n <= 0} onClick={() => onChange(n - step <= 0 ? "" : String(round(n - step)))}>
          <Minus className="size-5" aria-hidden />
        </button>
        <input
          type="number"
          min={0}
          step={decimal ? "0.5" : "1"}
          inputMode={decimal ? "decimal" : "numeric"}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full min-w-0 rounded-xl border-2 border-input bg-background px-2 text-center font-bold tabular-nums outline-none focus:border-primary",
            size === "lg" ? "h-12 text-xl" : "h-10 text-lg"
          )}
        />
        <button type="button" className={btn} aria-label={`${label} +${step}`} onClick={() => onChange(String(round(n + step)))}>
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  )
}
