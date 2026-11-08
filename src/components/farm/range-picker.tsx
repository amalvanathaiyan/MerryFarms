import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { cleanRange, rangeFor, type RangeKey } from "@/domain/reports"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PRESETS = ["today", "week", "month"] as const

/** The period a page shows, from its address (?range=…&from=…&to=…); this week unless asked. */
export function pickRange(sp: { range?: string; from?: string; to?: string }, now = new Date(), fallback: Exclude<RangeKey, "custom"> = "week") {
  const custom = sp.range === "custom" ? cleanRange(sp.from, sp.to, now) : null
  const key: RangeKey = custom ? "custom" : PRESETS.includes(sp.range as (typeof PRESETS)[number]) ? (sp.range as RangeKey) : fallback
  return { key, range: custom ?? rangeFor(key as Exclude<RangeKey, "custom">, now) }
}

/** Big Today / This week / This month buttons, and other dates tucked under "Other dates". */
export async function RangePicker({ basePath, current, range }: { basePath: string; current: RangeKey; range: { from: string; to: string } }) {
  const t = await getTranslations("farm.reports")
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p}
            href={`${basePath}?range=${p}`}
            aria-current={current === p ? "page" : undefined}
            className={cn("flex h-11 items-center justify-center rounded-full border-2 text-base font-semibold", current === p ? "border-primary bg-accent font-bold text-primary" : "bg-card")}
          >
            {t(`range_${p}`)}
          </Link>
        ))}
      </div>
      <details open={current === "custom"} className="rounded-2xl">
        <summary className="cursor-pointer px-1 text-sm font-semibold text-muted-foreground">{t("otherDates")}</summary>
        <form className="mt-2 flex flex-wrap items-end gap-2" action={basePath}>
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("from")}
            <Input type="date" name="from" defaultValue={range.from} className="h-11 w-40" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t("to")}
            <Input type="date" name="to" defaultValue={range.to} className="h-11 w-40" />
          </label>
          <Button type="submit" variant={current === "custom" ? "default" : "outline"} className="h-11">
            {t("show")}
          </Button>
        </form>
      </details>
    </div>
  )
}
