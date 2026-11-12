"use client"

import { useTranslations } from "next-intl"
import { ArrowRightLeft, Egg, TriangleAlert, Wheat } from "lucide-react"
import { LOSS_CAUSES } from "@/domain/batches"
import { EntryBlock } from "./entry-block"
import { NumberStepper } from "./number-stepper"

/** What was saved for one batch on one day, if anything. */
export interface SavedDay {
  feedKg: number | null
  eggsCollected: number | null
  eggsBroken: number | null
  sold: number
  soldPaise: number
  given: number
  note: string | null
  losses: { cause: string; count: number }[]
}

/** The day's numbers as typed (strings, so a box can be empty), and which of the folded parts are open. */
export interface DayValues {
  feed: string
  eggs: string
  broken: string
  sold: string
  given: string
  losses: Record<string, string>
  openLost: boolean
  openSold: boolean
}

const s = (v: number | null | undefined) => (v == null || v === 0 ? "" : String(v))
export const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v))

export function dayValues(e: SavedDay | null): DayValues {
  const losses = Object.fromEntries(LOSS_CAUSES.map((c) => [c, s(e?.losses.find((l) => l.cause === c)?.count)]))
  return {
    feed: s(e?.feedKg),
    eggs: s(e?.eggsCollected),
    broken: s(e?.eggsBroken),
    sold: s(e?.sold),
    given: s(e?.given),
    losses,
    openLost: Object.values(losses).some(Boolean),
    openSold: !!(e?.sold || e?.given),
  }
}

export const lostTotal = (v: DayValues) => LOSS_CAUSES.reduce((a, c) => a + (numOrNull(v.losses[c]) ?? 0), 0)

/** The day as the save actions take it. Sale money isn't typed here (it comes from Orders), so the saved one is kept. */
export function dayPayload(v: DayValues, showEggs: boolean, saved: SavedDay | null, note?: string) {
  return {
    feedKg: numOrNull(v.feed),
    eggsCollected: showEggs ? numOrNull(v.eggs) : null,
    eggsBroken: showEggs ? numOrNull(v.broken) : null,
    sold: numOrNull(v.sold) ?? 0,
    soldRupees: saved?.soldPaise ? saved.soldPaise / 100 : 0,
    given: numOrNull(v.given) ?? 0,
    note: note ?? saved?.note ?? undefined,
    losses: LOSS_CAUSES.map((cause) => ({ cause, count: numOrNull(v.losses[cause]) ?? 0 })).filter((l) => l.count > 0),
  }
}

/**
 * One batch's day: feed (with "same as last time"), eggs, birds lost by cause and birds sold or given. Losses and
 * sales stay folded until asked for. `onEdit` is for a changed number; `onFold` only opens or closes a part.
 */
export function DayFields({
  v,
  onEdit,
  onFold,
  showEggs,
  lastFeedKg,
}: {
  v: DayValues
  onEdit: (patch: Partial<DayValues>) => void
  onFold: (patch: Pick<Partial<DayValues>, "openLost" | "openSold">) => void
  showEggs: boolean
  lastFeedKg: number | null
}) {
  const t = useTranslations("farm.dayAll")
  const tb = useTranslations("farm.batches")
  const lost = lostTotal(v)
  const out = (Number(v.sold) || 0) + (Number(v.given) || 0)
  return (
    <>
      <EntryBlock icon={Wheat} title={t("blockFeed")}>
        <NumberStepper label={t("feedKgGiven")} value={v.feed} onChange={(x) => onEdit({ feed: x })} decimal />
        {lastFeedKg != null && v.feed !== String(lastFeedKg) && (
          <button type="button" onClick={() => onEdit({ feed: String(lastFeedKg) })} className="self-start rounded-full border-2 border-dashed border-primary px-3 py-1 text-sm font-semibold text-primary">
            {t("sameAsLast", { kg: lastFeedKg })}
          </button>
        )}
      </EntryBlock>

      {showEggs && (
        <EntryBlock icon={Egg} title={t("blockEggs")}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberStepper size="sm" label={t("eggsGot")} value={v.eggs} onChange={(x) => onEdit({ eggs: x })} />
            <NumberStepper size="sm" label={t("eggsBrokenShort")} value={v.broken} onChange={(x) => onEdit({ broken: x })} />
          </div>
        </EntryBlock>
      )}

      <EntryBlock
        icon={TriangleAlert}
        title={t("blockLost")}
        tone={lost > 0 ? "bad" : undefined}
        summary={lost > 0 ? t("lostCount", { count: lost }) : t("noneTapToAdd")}
        open={v.openLost}
        onToggle={() => onFold({ openLost: !v.openLost })}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {LOSS_CAUSES.map((c) => (
            <NumberStepper key={c} size="sm" label={tb(`cause_${c}`)} value={v.losses[c]} onChange={(x) => onEdit({ losses: { ...v.losses, [c]: x } })} />
          ))}
        </div>
      </EntryBlock>

      <EntryBlock
        icon={ArrowRightLeft}
        title={t("blockOut")}
        summary={out > 0 ? t("outSummary", { sold: Number(v.sold) || 0, given: Number(v.given) || 0 }) : t("noneTapToAdd")}
        open={v.openSold}
        onToggle={() => onFold({ openSold: !v.openSold })}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberStepper size="sm" label={tb("sold")} value={v.sold} onChange={(x) => onEdit({ sold: x })} />
          <NumberStepper size="sm" label={tb("given")} value={v.given} onChange={(x) => onEdit({ given: x })} />
        </div>
        <p className="text-xs text-muted-foreground">{t("outHint")}</p>
      </EntryBlock>
    </>
  )
}
