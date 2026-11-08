import { ChevronDown, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * One labelled part of a batch's day (Feed, Eggs, Birds lost, Birds sold or given): a heading with its picture, so
 * each kind of number is clearly apart. With onToggle, the heading opens and closes it and shows a summary.
 */
export function EntryBlock({
  icon: Icon,
  title,
  summary,
  tone,
  open = true,
  onToggle,
  children,
}: {
  icon: LucideIcon
  title: string
  summary?: string
  tone?: "bad"
  open?: boolean
  onToggle?: () => void
  children: React.ReactNode
}) {
  const head = (
    <>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", tone === "bad" ? "bg-destructive/15 text-destructive" : "bg-sec-poultry-tint text-sec-poultry")}>
        <Icon className="size-4" aria-hidden />
      </span>
      {/* The summary sits under the title (not beside it), so long Tamil words never squeeze or overlap. */}
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="leading-tight font-bold">{title}</span>
        {summary && <span className={cn("text-sm leading-snug font-semibold", tone === "bad" ? "text-destructive" : "text-muted-foreground")}>{summary}</span>}
      </span>
      {onToggle && <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />}
    </>
  )
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border p-3", tone === "bad" ? "border-destructive/30 bg-destructive/5" : "bg-muted/30")}>
      {onToggle ? (
        <button type="button" aria-expanded={open} onClick={onToggle} className="-m-1 flex items-center gap-2 rounded-lg p-1">
          {head}
        </button>
      ) : (
        <div className="flex items-center gap-2">{head}</div>
      )}
      {(!onToggle || open) && children}
    </div>
  )
}

