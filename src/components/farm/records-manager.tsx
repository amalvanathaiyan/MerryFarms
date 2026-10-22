"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addExpense, deleteExpense, saveDayRecord } from "@/app/actions/records"
import { EXPENSE_KINDS, type DayRecord, type ExpenseKind } from "@/domain/records"
import { formatRupees } from "@/domain/money"
import { cn } from "@/lib/utils"

type Row = DayRecord & { note: string | null; dayText: string }
type ExpenseRow = { id: string; dayText: string; kind: string; amountPaise: number; note: string | null }

const num = (v: string) => (v.trim() === "" ? null : Number(v))
const str = (v: number | null | undefined) => (v == null ? "" : String(v))

/** Daily flock figures (owner or packing) and farm expenses (owner). */
export function RecordsManager({ today, records, expenses, canSpend }: { today: string; records: Row[]; expenses: ExpenseRow[]; canSpend: boolean }) {
  const t = useTranslations("farm.records")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const formFor = (date: string) => {
    const r = records.find((x) => x.date === date)
    // A new day starts from yesterday's bird count, which rarely changes.
    const lastBirds = records.find((x) => x.date < date && x.birds != null)?.birds
    return { date, eggsCollected: str(r?.eggsCollected), eggsBroken: str(r?.eggsBroken), birds: str(r?.birds ?? lastBirds), birdsLost: str(r?.birdsLost), feedKg: str(r?.feedKg), note: r?.note ?? "" }
  }
  const [day, setDay] = useState(formFor(today))
  const [spend, setSpend] = useState<{ date: string; kind: ExpenseKind; amount: string; note: string }>({ date: today, kind: "feed", amount: "", note: "" })

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      setSaved(false)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })

  const field = (key: "eggsCollected" | "eggsBroken" | "birds" | "birdsLost" | "feedKg", decimal = false) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {t(key)}
      <Input
        type="number"
        min={0}
        step={decimal ? "0.5" : "1"}
        inputMode={decimal ? "decimal" : "numeric"}
        value={day[key]}
        onChange={(e) => (setSaved(false), setDay({ ...day, [key]: e.target.value }))}
        className="h-12 text-lg font-normal tabular-nums"
      />
    </label>
  )

  const monthTotal = expenses.reduce((a, e) => a + e.amountPaise, 0)

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <form
        className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () =>
              saveDayRecord({
                date: day.date,
                eggsCollected: num(day.eggsCollected),
                eggsBroken: num(day.eggsBroken),
                birds: num(day.birds),
                birdsLost: num(day.birdsLost),
                feedKg: num(day.feedKg),
                note: day.note || undefined,
              }),
            () => setSaved(true)
          )
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("dayTitle")}</h2>
          <Input type="date" max={today} value={day.date} onChange={(e) => e.target.value && (setSaved(false), setDay(formFor(e.target.value)))} className="h-10 w-auto" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field("eggsCollected")}
          {field("eggsBroken")}
          {field("birds")}
          {field("birdsLost")}
          {field("feedKg", true)}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("note")}
          <Input value={day.note} maxLength={200} onChange={(e) => setDay({ ...day, note: e.target.value })} placeholder={t("notePlaceholder")} className="font-normal" />
        </label>
        <Button type="submit" size="lg" disabled={pending}>
          {saved ? `✓ ${t("saved")}` : t("save")}
        </Button>
      </form>

      {records.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 font-semibold">{t("recent")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-medium">{t("date")}</th>
                  <th className="px-2 text-right font-medium">{t("eggsShort")}</th>
                  <th className="px-2 text-right font-medium">{t("brokenShort")}</th>
                  <th className="px-2 text-right font-medium">{t("birdsShort")}</th>
                  <th className="px-2 text-right font-medium">{t("lostShort")}</th>
                  <th className="pl-2 text-right font-medium">{t("feedShort")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {records.map((r) => (
                  <tr key={r.date} className="cursor-pointer" onClick={() => setDay(formFor(r.date))}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{r.dayText}</td>
                    <td className="px-2 text-right font-semibold">{r.eggsCollected ?? "—"}</td>
                    <td className="px-2 text-right">{r.eggsBroken ?? "—"}</td>
                    <td className="px-2 text-right">{r.birds ?? "—"}</td>
                    <td className={cn("px-2 text-right", (r.birdsLost ?? 0) > 0 && "font-semibold text-destructive")}>{r.birdsLost ?? "—"}</td>
                    <td className="pl-2 text-right">{r.feedKg ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canSpend && (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("expenses")}</h2>
            <span className="text-sm text-muted-foreground tabular-nums">
              {t("thisMonth")}: <b className="text-foreground">{formatRupees(monthTotal)}</b>
            </span>
          </div>
          <form
            className="flex flex-col gap-3 rounded-xl border border-dashed p-3"
            onSubmit={(e) => {
              e.preventDefault()
              run(() => addExpense({ date: spend.date, kind: spend.kind, amountRupees: Number(spend.amount), note: spend.note || undefined }), () => setSpend({ ...spend, amount: "", note: "" }))
            }}
          >
            <div className="flex flex-wrap gap-2">
              {EXPENSE_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={spend.kind === k} onClick={() => setSpend({ ...spend, kind: k })} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", spend.kind === k ? "border-primary bg-accent" : "bg-card")}>
                  {t(`kind_${k}`)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t("amount")}
                <Input required type="number" min={1} step="0.5" inputMode="decimal" value={spend.amount} onChange={(e) => setSpend({ ...spend, amount: e.target.value })} className="h-11 font-normal tabular-nums" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t("date")}
                <Input type="date" max={today} value={spend.date} onChange={(e) => setSpend({ ...spend, date: e.target.value })} className="h-11 font-normal" />
              </label>
            </div>
            <Input value={spend.note} maxLength={120} onChange={(e) => setSpend({ ...spend, note: e.target.value })} placeholder={t("expenseNote")} />
            <Button type="submit" disabled={pending || !(Number(spend.amount) > 0)}>
              {t("addExpense")}
            </Button>
          </form>
          {expenses.length === 0 && <p className="text-sm text-muted-foreground">{t("noExpenses")}</p>}
          <ul className="divide-y">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">
                    {t(`kind_${e.kind}`)} <span className="font-normal text-muted-foreground">· {e.dayText}</span>
                  </div>
                  {e.note && <div className="truncate text-sm text-muted-foreground">{e.note}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <b className="tabular-nums">{formatRupees(e.amountPaise)}</b>
                  <button type="button" className="grid size-9 place-items-center rounded-lg text-muted-foreground" disabled={pending} aria-label={t("deleteExpense")} onClick={() => run(() => deleteExpense(e.id))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
