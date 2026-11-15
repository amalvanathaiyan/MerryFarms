import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { ChevronRight } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { landTabs } from "@/lib/farm-sections"
import { istDate } from "@/domain/ist"
import { isLow } from "@/domain/inputs"
import { storeList } from "@/server/inputs"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/farm/section-header"
import { AddInput } from "@/components/farm/store-forms"

/**
 * My farm · Store: everything the farm buys and uses up, each with what's left (running low first). Each opens its
 * own page to buy, use or count it. Items no longer kept are folded at the end.
 */
export default async function StorePage() {
  const { db, tenant } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.store")
  const poultry = featuresOf(tenant).poultryCare
  const list = await storeList(db, istDate(new Date()))
  const kept = list.filter((r) => !r.item.retiredAt).sort((a, b) => Number(isLow(b.stock.left, b.item.lowAt)) - Number(isLow(a.stock.left, a.item.lowAt)))
  const gone = list.filter((r) => r.item.retiredAt)
  const lowCount = kept.filter((r) => isLow(r.stock.left, r.item.lowAt)).length

  const row = ({ item, stock }: (typeof list)[number]) => {
    const low = isLow(stock.left, item.lowAt)
    return (
      <li key={item.id}>
        <Link href={`/farm/land/store/${item.id}`} className={cn("flex min-h-14 items-center gap-3 rounded-2xl border bg-card px-4 py-2 hover:border-primary", low && "border-yolk")}>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{item.name}</span>
            <span className="block text-sm text-muted-foreground">{[t(`kind_${item.kind}`), item.batchFeed && t("batchFeedShort")].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-right">
            <span className={cn("block font-bold tabular-nums", stock.left < 0 && "text-destructive")}>{t("leftValue", { qty: stock.left, unit: t(`unit_${item.unit}`) })}</span>
            {low && <span className="block rounded-md bg-yolk px-1.5 text-xs font-semibold text-yolk-foreground">{t("low")}</span>}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" tabs={landTabs()} active="store" back={{ href: "/farm/more" }} />
      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("none")}</p>
      ) : (
        <>
          {lowCount > 0 && <p className="rounded-2xl bg-yolk px-4 py-3 font-semibold text-yolk-foreground">{t("lowCount", { count: lowCount })}</p>}
          <ul className="flex flex-col gap-2">{kept.map(row)}</ul>
        </>
      )}
      <AddInput poultry={poultry} />
      {gone.length > 0 && (
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{t("retiredTitle", { count: gone.length })}</summary>
          <ul className="flex flex-col gap-2 p-3">{gone.map(row)}</ul>
        </details>
      )}
    </div>
  )
}
