"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2, ChevronDown, ClipboardList, Plus, Save, Scale, Syringe } from "lucide-react"
import { saveBatchEntryAction } from "@/app/actions/poultry-entry"
import { useCheer } from "@/components/cheer"
import { dayCheer } from "@/domain/cheers"
import { VACCINE_METHODS } from "@/domain/vaccinations"
import { avgGrams, MAX_WEIGHED, weightText } from "@/domain/weights"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { DayFields, dayPayload, dayValues, lostTotal, numOrNull, type DayValues, type SavedDay } from "./day-fields"
import { NumberStepper } from "./number-stepper"

export interface EntryDose {
  id: string
  vaccine: string
  method: string | null
  /** "Due today" or "Late since …", already worded. */
  dueText: string
  late: boolean
}

export interface EntryBatch {
  id: string
  name: string
  number: number
  /** Birds at the start of the day. */
  alive: number
  showEggs: boolean
}

type Part = "day" | "weight" | "dose"

/**
 * Entry · one batch: numbered sections and one Save. Daily (feed, eggs, losses, sales) is always open; Vaccines
 * opens by itself when a dose is due, and is one "+ Add" line otherwise. Weighing is weekly, so it's here only in
 * the week it's due; any other day it's entered on the Growth tab. Only what was
 * filled in is sent; the result says what was saved.
 */
export function BatchEntryForm({
  batch,
  date,
  isOwner,
  saved,
  lastFeedKg,
  weighing,
  doses,
  givenOnDay,
  suggestions,
}: {
  batch: EntryBatch
  date: string
  isOwner: boolean
  saved: SavedDay | null
  lastFeedKg: number | null
  weighing: { due: boolean; daysSince: number | null; onDay: { birds: number; totalGrams: number } | null; lastBirds: number | null }
  /** Doses planned for this batch and not given yet, due on or before today. */
  doses: EntryDose[]
  /** Doses already marked given on this day. */
  givenOnDay: { vaccine: string; birds: number | null }[]
  suggestions: string[]
}) {
  const t = useTranslations("farm.entry")
  const tw = useTranslations("farm.weights")
  const tv = useTranslations("farm.vaccines")
  const tb = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()

  const [day, setDay] = useState<DayValues>(() => dayValues(saved))
  const [dayTouched, setDayTouched] = useState(false)
  const [note, setNote] = useState(saved?.note ?? "")

  const weighBlank = () => ({
    open: weighing.due || !!weighing.onDay,
    birds: String(weighing.onDay?.birds ?? weighing.lastBirds ?? 10),
    kg: weighing.onDay ? String(weighing.onDay.totalGrams / 1000) : "",
  })
  const [weigh, setWeigh] = useState(weighBlank)
  // Weighing is weekly: on Entry only when due or already done this day; otherwise on the Growth tab.
  const showWeighing = weighing.due || !!weighing.onDay
  const [weighTouched, setWeighTouched] = useState(false)

  const [give, setGive] = useState<Record<string, { on: boolean; birds: string; cost: string }>>({})
  const [vaccinesOpen, setVaccinesOpen] = useState(doses.length > 0)
  const doseBlank = { open: false, vaccine: "", method: "", birds: String(batch.alive), cost: "" }
  const [extra, setExtra] = useState(doseBlank)

  const [result, setResult] = useState<{ saved: Part[]; failed: { part: Part; code: string } | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const touch = () => (setResult(null), setError(null))

  // What one Save will send.
  const noteChanged = note.trim() !== (saved?.note ?? "")
  const sendDay = dayTouched || noteChanged
  const birds = Number(weigh.birds)
  const kg = Number(weigh.kg)
  const sendWeight = weigh.open && weighTouched && birds >= 1 && birds <= MAX_WEIGHED && kg > 0
  const giving = doses.filter((d) => give[d.id]?.on)
  const sendExtra = extra.open && extra.vaccine.trim().length > 0
  const anything = sendDay || sendWeight || giving.length > 0 || sendExtra
  const preview = birds > 0 && kg > 0 ? weightText(avgGrams({ birds, totalGrams: Math.round(kg * 1000) })) : null

  const partName = (p: Part) => t(`part_${p}`)
  const errorText = (code: string) => (te.has(code) ? te(code) : te("generic"))

  const save = () =>
    start(async () => {
      setError(null)
      setResult(null)
      const r = await saveBatchEntryAction(batch.id, {
        date,
        day: sendDay ? dayPayload(day, batch.showEggs, saved, note.trim()) : undefined,
        weight: sendWeight ? { birds, totalKg: kg } : undefined,
        give: giving.length ? giving.map((d) => ({ doseId: d.id, birds: numOrNull(give[d.id].birds), costRupees: isOwner ? numOrNull(give[d.id].cost) : null })) : undefined,
        newDose: sendExtra ? { vaccine: extra.vaccine.trim(), method: extra.method || null, birds: numOrNull(extra.birds), costRupees: isOwner ? numOrNull(extra.cost) : null } : undefined,
      })
      if (!r.ok) return setError(errorText(r.error))
      setResult({ saved: r.saved, failed: r.failed })
      if (r.saved.includes("day")) {
        setDayTouched(false)
        const c = dayCheer([{ name: batch.name, eggs: batch.showEggs ? numOrNull(day.eggs) : null, lost: lostTotal(day) }])
        cheer(c.kind, c.values)
      } else if (r.saved.includes("weight") && preview) cheer("weight", { batch: batch.name, avg: `${preview.value} ${tw(preview.unit)}` })
      else if (r.saved.includes("dose")) cheer("dose", { name: giving[0]?.vaccine ?? extra.vaccine })
      if (r.saved.includes("weight")) setWeighTouched(false)
      if (r.saved.includes("dose")) {
        setGive({})
        if (r.failed?.part !== "dose") setExtra(doseBlank)
      }
    })

  return (
    <div className="flex flex-col gap-3">
      {/* 1 · Daily: every day, always open */}
      <Section n={1} icon={ClipboardList} title={t("s1")} hint={t("s1Hint")} chip={saved && !dayTouched ? { text: t("entered"), tone: "done" } : null}>
        <DayFields
          v={day}
          onEdit={(p) => (touch(), setDayTouched(true), setDay((v) => ({ ...v, ...p })))}
          onFold={(p) => setDay((v) => ({ ...v, ...p }))}
          showEggs={batch.showEggs}
          lastFeedKg={lastFeedKg}
        />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {tb("note")}
          <Input value={note} maxLength={200} onChange={(e) => (touch(), setNote(e.target.value))} placeholder={tb("notePlaceholder")} className="font-normal" />
        </label>
      </Section>

      {/* 2 · Vaccines: doses due now, and one given that wasn't planned */}
      <Section
        n={2}
        icon={Syringe}
        title={t("s3")}
        hint={t("s3Hint")}
        chip={doses.length > 0 ? { text: t("dosesDue", { count: doses.length }), tone: doses.some((d) => d.late) ? "late" : "due" } : givenOnDay.length > 0 ? { text: t("entered"), tone: "done" } : { text: t("noneDue"), tone: "quiet" }}
        open={vaccinesOpen}
        onOpen={() => setVaccinesOpen(!vaccinesOpen)}
        onAdd={() => (setVaccinesOpen(true), doses.length === 0 && setExtra({ ...doseBlank, open: true }))}
        closedText={t("addDose")}
      >
        {givenOnDay.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {givenOnDay.map((g, i) => (
              <li key={i} className="flex items-center gap-1.5 font-semibold text-primary">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {g.vaccine}
                {g.birds != null && <span className="font-normal text-muted-foreground"> · {tv("birdsGiven", { count: g.birds })}</span>}
              </li>
            ))}
          </ul>
        )}

        {doses.map((d) => {
          const g = give[d.id] ?? { on: false, birds: String(batch.alive), cost: "" }
          const set = (patch: Partial<typeof g>) => (touch(), setGive((all) => ({ ...all, [d.id]: { ...g, ...patch } })))
          return (
            <div key={d.id} className={cn("flex flex-col gap-2 rounded-xl border-2 p-3", g.on ? "border-primary bg-accent/40" : "border-border")}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={g.on} onChange={(e) => set({ on: e.target.checked })} className="mt-0.5 size-6 shrink-0 accent-primary" />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {d.vaccine}
                    {d.method && <span className="font-normal text-muted-foreground"> · {tv(`method_${d.method}`)}</span>}
                  </span>
                  <span className={cn("block text-sm", d.late ? "font-semibold text-destructive" : "text-muted-foreground")}>{d.dueText}</span>
                  <span className="block text-sm font-semibold">{t("tickGiven")}</span>
                </span>
              </label>
              {g.on && (
                <div className={cn("grid gap-2", isOwner ? "grid-cols-2" : "grid-cols-1")}>
                  <Field label={tv("birds")}>
                    <Input type="number" min={0} inputMode="numeric" value={g.birds} onChange={(e) => set({ birds: e.target.value })} className="h-11 font-normal tabular-nums" />
                  </Field>
                  {isOwner && (
                    <Field label={tv("cost")}>
                      <Input type="number" min={0} step="0.5" inputMode="decimal" value={g.cost} onChange={(e) => set({ cost: e.target.value })} className="h-11 font-normal tabular-nums" />
                    </Field>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {extra.open ? (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed p-3">
            <h3 className="font-bold">{t("extraTitle")}</h3>
            <Field label={tv("vaccine")}>
              <Input list="entry-vaccine-names" maxLength={60} value={extra.vaccine} onChange={(e) => (touch(), setExtra({ ...extra, vaccine: e.target.value }))} placeholder={tv("vaccinePlaceholder")} className="h-11 font-normal" />
              <datalist id="entry-vaccine-names">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{tv("howGiven")}</span>
              <div className="flex flex-wrap gap-2">
                {VACCINE_METHODS.map((m) => (
                  <button key={m} type="button" aria-pressed={extra.method === m} onClick={() => setExtra({ ...extra, method: extra.method === m ? "" : m })} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", extra.method === m ? "border-primary bg-accent" : "bg-card")}>
                    {tv(`method_${m}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn("grid gap-2", isOwner ? "grid-cols-2" : "grid-cols-1")}>
              <Field label={tv("birds")}>
                <Input type="number" min={0} inputMode="numeric" value={extra.birds} onChange={(e) => setExtra({ ...extra, birds: e.target.value })} className="h-11 font-normal tabular-nums" />
              </Field>
              {isOwner && (
                <Field label={tv("cost")}>
                  <Input type="number" min={0} step="0.5" inputMode="decimal" value={extra.cost} onChange={(e) => setExtra({ ...extra, cost: e.target.value })} className="h-11 font-normal tabular-nums" />
                </Field>
              )}
            </div>
            <button type="button" onClick={() => setExtra(doseBlank)} className="self-start text-sm font-semibold text-muted-foreground underline underline-offset-4">
              {tv("cancel")}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setExtra({ ...doseBlank, open: true })} className="flex items-center gap-2 self-start rounded-full border-2 border-dashed border-primary px-3 py-1.5 text-sm font-semibold text-primary">
            <Plus className="size-4" aria-hidden /> {t("extraButton")}
          </button>
        )}
      </Section>

      {showWeighing ? (
        <>
      {/* 3 · Weighing: only in the week it's due (or already weighed this day); any other day it's on Growth */}
      <Section
        n={3}
        icon={Scale}
        title={t("s2")}
        hint={tw("hint")}
        chip={weighing.onDay && !weighTouched ? { text: t("entered"), tone: "done" } : weighing.due ? { text: weighing.daysSince == null ? tw("dueFirst") : tw("due"), tone: "due" } : weighing.daysSince != null ? { text: tw("weighedAgo", { days: weighing.daysSince }), tone: "quiet" } : null}
        open={weigh.open}
        onOpen={() => setWeigh((w) => ({ ...w, open: !w.open }))}
        closedText={t("addWeighing")}
      >
        <NumberStepper label={tw("birds")} value={weigh.birds} onChange={(s) => (touch(), setWeighTouched(true), setWeigh((w) => ({ ...w, birds: s })))} />
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {tw("total")}
          <Input type="number" inputMode="decimal" min={0.01} max={10000} step="0.01" value={weigh.kg} onChange={(e) => (touch(), setWeighTouched(true), setWeigh((w) => ({ ...w, kg: e.target.value })))} className="h-12 text-lg font-normal" />
          <span className="font-normal text-muted-foreground">{tw("totalHint")}</span>
        </label>
        {preview && <p className="text-base font-bold tabular-nums">= {tw("preview", { value: preview.value, unit: tw(preview.unit) })}</p>}
      </Section>
        </>
      ) : (
        <Link href="/farm/poultry/growth" className="flex items-center gap-2 self-start px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
          <Scale className="size-4" aria-hidden /> {t("weighOnGrowth")}
        </Link>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="flex flex-col gap-1 rounded-xl border bg-card px-3 py-2 text-sm font-semibold">
          {result.saved.length > 0 && (
            <p className="flex items-center gap-1.5 text-primary">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden /> {t("savedParts", { parts: result.saved.map(partName).join(", ") })}
            </p>
          )}
          {result.failed && <p className="text-destructive">{t("failedPart", { part: partName(result.failed.part), reason: errorText(result.failed.code) })}</p>}
        </div>
      )}

      <div className="sticky bottom-24 z-10 lg:bottom-4">
        <button
          type="button"
          disabled={pending || !anything}
          onClick={save}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sec-poultry text-lg font-bold text-sec-on shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        >
          <Save className="size-5" aria-hidden />
          {pending ? t("saving") : anything ? t("save") : result?.saved.length ? `✓ ${t("allSaved")}` : t("nothingYet")}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}

const CHIP: Record<"done" | "due" | "late" | "quiet", string> = {
  done: "bg-accent text-primary",
  due: "bg-yolk text-yolk-foreground",
  late: "bg-destructive/10 text-destructive",
  quiet: "bg-muted text-muted-foreground",
}

/**
 * One numbered section of the Entry page. Without onOpen it's always open; with it, the heading opens and closes it
 * and a closed one shows a single "+ Add" line.
 */
function Section({
  n,
  icon: Icon,
  title,
  hint,
  chip,
  open = true,
  onOpen,
  closedText,
  onAdd,
  children,
}: {
  n: number
  icon: typeof Scale
  title: string
  hint: string
  chip: { text: string; tone: keyof typeof CHIP } | null
  open?: boolean
  onOpen?: () => void
  closedText?: string
  /** What the closed "+ Add" line does (opens the section, unless said otherwise). */
  onAdd?: () => void
  children: React.ReactNode
}) {
  const head = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sec-poultry text-base font-bold text-sec-on" aria-hidden>
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-lg leading-tight font-bold">
          <Icon className="size-5 shrink-0 text-sec-poultry" aria-hidden /> {title}
        </span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
        {chip && <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold", CHIP[chip.tone])}>{chip.text}</span>}
      </span>
    </>
  )
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
          {head}
          <ChevronDown className={cn("mt-1.5 size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      ) : (
        <div className="flex items-start gap-3">{head}</div>
      )}
      {open ? children : closedText && (
        <button type="button" onClick={onAdd ?? onOpen} className="flex items-center gap-2 self-start rounded-full border-2 border-dashed border-primary px-3 py-1.5 text-sm font-semibold text-primary">
          <Plus className="size-4" aria-hidden /> {closedText}
        </button>
      )}
    </section>
  )
}
