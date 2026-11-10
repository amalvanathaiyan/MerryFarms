"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { CheckCircle2, Syringe, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addDoseAction, applyScheduleAction, deleteDoseAction, giveDoseAction, undoDoseAction } from "@/app/actions/vaccinations"
import { VACCINE_METHODS, type DoseState } from "@/domain/vaccinations"
import { formatRupees } from "@/domain/money"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

export interface DoseRow {
  id: string
  vaccine: string
  method: string | null
  dueDate: string | null
  dueText: string | null
  /** Age the dose is planned at, in days. */
  dueAge: number | null
  givenDate: string | null
  givenText: string | null
  birds: number | null
  costPaise: number | null
  note: string | null
  state: DoseState
}

const num = (v: string) => (v.trim() === "" ? null : Number(v))

const STATE_STYLE: Record<DoseState, string> = {
  given: "bg-accent text-primary",
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-yolk text-yolk-foreground",
  soon: "border border-dashed border-primary text-primary",
  later: "bg-muted text-muted-foreground",
  unplanned: "bg-muted text-muted-foreground",
}

/** A batch's vaccinations: what's planned and when, marking a dose given, and adding one. */
export function BatchVaccinations({
  batchId,
  today,
  minDate,
  maxDate,
  aliveNow,
  isOwner,
  canApplySchedule,
  doses,
  suggestions,
}: {
  batchId: string
  today: string
  minDate: string
  maxDate: string
  aliveNow: number
  isOwner: boolean
  canApplySchedule: boolean
  doses: DoseRow[]
  suggestions: string[]
}) {
  const t = useTranslations("farm.vaccines")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [giving, setGiving] = useState<string | null>(null)
  const [give, setGive] = useState({ date: today, birds: "", cost: "", note: "" })
  const [adding, setAdding] = useState(false)
  const blank = { vaccine: "", method: "" as string, given: true, date: maxDate, birds: String(aliveNow), cost: "", note: "" }
  const [add, setAdd] = useState(blank)

  const run = (fn: () => Promise<{ ok: boolean; error?: string; added?: number }>, after?: (r: { added?: number }) => void) =>
    start(async () => {
      setError(null)
      setNotice(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else after?.(r)
    })

  const openGive = (d: DoseRow) => {
    setGiving(d.id)
    setGive({
      // A dose being marked now was most likely given now (after the reminder), not on its planned day.
      date: d.givenDate ?? maxDate,
      birds: String(d.birds ?? aliveNow),
      cost: d.costPaise ? String(d.costPaise / 100) : "",
      note: d.note ?? "",
    })
  }

  const label = (text: string, input: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {text}
      {input}
    </label>
  )

  const statusText = (d: DoseRow) =>
    d.state === "given"
      ? t("givenOn", { day: d.givenText ?? "" })
      : d.state === "overdue"
        ? t("overdueSince", { day: d.dueText ?? "" })
        : d.state === "today"
          ? t("dueToday")
          : d.state === "unplanned"
            ? t("notPlanned")
            : t("dueOn", { day: d.dueText ?? "" })

  return (
    <section id="vaccinations" className="scroll-mt-4 flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Syringe className="size-5" /> {t("title")}
        </h2>
        {isOwner && (
          <Link href="/farm/poultry/vaccines/plan" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("farmPlan")} →
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {notice && <p className="rounded-lg bg-accent px-3 py-2 text-sm font-medium">{notice}</p>}

      {doses.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}

      {isOwner && canApplySchedule && (
        <Button variant="outline" className="self-start" disabled={pending} onClick={() => run(() => applyScheduleAction(batchId), (r) => (setNotice(t("planAdded", { count: r.added ?? 0 })), cheer("vaccinePlan")))}>
          {t("applyPlan")}
        </Button>
      )}

      <ul className="flex flex-col gap-2">
        {doses.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 rounded-xl border p-3">
            {/* The status sits under the name on phones: Tamil labels are long. */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
              <div className="min-w-0">
                <div className="font-semibold">
                  {d.vaccine}
                  {d.method && <span className="font-normal text-muted-foreground"> · {t(`method_${d.method}`)}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[d.dueAge != null && t("atAge", { days: d.dueAge }), d.state === "given" && d.birds != null && t("birdsGiven", { count: d.birds }), isOwner && d.costPaise ? formatRupees(d.costPaise) : null, d.note]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span className={cn("self-start rounded-full px-2 py-0.5 text-xs font-semibold sm:shrink-0", STATE_STYLE[d.state])}>
                {d.state === "given" && <CheckCircle2 className="mr-1 inline size-3.5" />}
                {statusText(d)}
              </span>
            </div>

            {giving === d.id ? (
              <form
                className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run(() => giveDoseAction(d.id, { givenDate: give.date, birds: num(give.birds), costRupees: num(give.cost), note: give.note || undefined }), () => (setGiving(null), cheer("dose", { name: d.vaccine })))
                }}
              >
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {label(t("givenDay"), <Input type="date" required min={minDate} max={maxDate} value={give.date} onChange={(e) => setGive({ ...give, date: e.target.value })} className="h-11 font-normal" />)}
                  {label(t("birds"), <Input type="number" min={0} inputMode="numeric" value={give.birds} onChange={(e) => setGive({ ...give, birds: e.target.value })} className="h-11 font-normal tabular-nums" />)}
                  {isOwner && label(t("cost"), <Input type="number" min={0} step="0.5" inputMode="decimal" value={give.cost} onChange={(e) => setGive({ ...give, cost: e.target.value })} className="h-11 font-normal tabular-nums" />)}
                </div>
                <Input value={give.note} maxLength={200} onChange={(e) => setGive({ ...give, note: e.target.value })} placeholder={t("notePlaceholder")} />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={pending}>
                    {t("saveGiven")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setGiving(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                {d.state === "given" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => openGive(d)}>
                      {t("change")}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => undoDoseAction(d.id), () => cheer("doseUndone", { name: d.vaccine }))}>
                      {t("undo")}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => openGive(d)}>
                    {t("markGiven")}
                  </Button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    className="ml-auto grid size-9 place-items-center rounded-lg text-muted-foreground"
                    aria-label={t("delete")}
                    disabled={pending}
                    onClick={() => window.confirm(t("deleteConfirm", { name: d.vaccine })) && run(() => deleteDoseAction(d.id), () => cheer("deleted"))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(
              () =>
                addDoseAction(batchId, {
                  vaccine: add.vaccine,
                  method: add.method || null,
                  dueDate: add.given ? null : add.date,
                  givenDate: add.given ? add.date : null,
                  birds: add.given ? num(add.birds) : null,
                  costRupees: add.given ? num(add.cost) : null,
                  note: add.note || undefined,
                }),
              () => (setAdding(false), setAdd(blank), add.given ? cheer("dose", { name: add.vaccine }) : cheer("vaccinePlan"))
            )
          }}
        >
          {label(
            t("vaccine"),
            <>
              <Input required list="vaccine-names" maxLength={60} value={add.vaccine} onChange={(e) => setAdd({ ...add, vaccine: e.target.value })} placeholder={t("vaccinePlaceholder")} className="h-11 font-normal" />
              <datalist id="vaccine-names">
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("howGiven")}</span>
            <div className="flex flex-wrap gap-2">
              {VACCINE_METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={add.method === m} onClick={() => setAdd({ ...add, method: add.method === m ? "" : m })} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", add.method === m ? "border-primary bg-accent" : "bg-card")}>
                  {t(`method_${m}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([true, false] as const).map((g) => (
              <button
                key={String(g)}
                type="button"
                aria-pressed={add.given === g}
                onClick={() => setAdd({ ...add, given: g, date: g ? maxDate : today })}
                className={cn("rounded-full border px-4 py-2 text-sm font-medium", add.given === g ? "border-primary bg-accent" : "bg-card")}
              >
                {g ? t("alreadyGiven") : t("planIt")}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {label(
              add.given ? t("givenDay") : t("dueDay"),
              <Input type="date" required min={minDate} max={add.given ? maxDate : undefined} value={add.date} onChange={(e) => setAdd({ ...add, date: e.target.value })} className="h-11 font-normal" />
            )}
            {add.given && label(t("birds"), <Input type="number" min={0} inputMode="numeric" value={add.birds} onChange={(e) => setAdd({ ...add, birds: e.target.value })} className="h-11 font-normal tabular-nums" />)}
            {add.given && isOwner && label(t("cost"), <Input type="number" min={0} step="0.5" inputMode="decimal" value={add.cost} onChange={(e) => setAdd({ ...add, cost: e.target.value })} className="h-11 font-normal tabular-nums" />)}
          </div>
          <Input value={add.note} maxLength={200} onChange={(e) => setAdd({ ...add, note: e.target.value })} placeholder={t("notePlaceholder")} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !add.vaccine.trim()}>
              {t("add")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setAdding(true)}>
          <Syringe className="size-4" /> {t("addOne")}
        </Button>
      )}
    </section>
  )
}
