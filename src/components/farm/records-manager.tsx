"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addExpense, deleteExpense } from "@/app/actions/records"
import { EXPENSE_KINDS, type ExpenseKind } from "@/domain/records"
import { formatRupees } from "@/domain/money"
import { cn } from "@/lib/utils"

type ExpenseRow = { id: string; dayText: string; kind: string; amountPaise: number; quantityKg: number | null; batchName: string | null; note: string | null }
type BatchOption = { id: string; name: string }

/** Production (any farm), batches of birds (poultry farms only) and expenses (owner). */
export function RecordsManager({
  today,
  expenses,
  canSpend,
  batches,
  poultry,
  batchOptions,
  production,
}: {
  today: string
  expenses: ExpenseRow[]
  canSpend: boolean
  batches: React.ReactNode
  /** Poultry care on: feed is bought by the kg and spending can go on one batch. */
  poultry: boolean
  batchOptions: BatchOption[]
  production: React.ReactNode
}) {
  const t = useTranslations("farm.records")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const empty = { date: today, kind: "feed" as ExpenseKind, amount: "", kg: "", batchId: "", note: "" }
  const [spend, setSpend] = useState(empty)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })

  const monthTotal = expenses.reduce((a, e) => a + e.amountPaise, 0)
  const isFeed = poultry && spend.kind === "feed"

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {batches}

      {production}

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
              run(
                () =>
                  addExpense({
                    date: spend.date,
                    kind: spend.kind,
                    amountRupees: Number(spend.amount),
                    quantityKg: isFeed && spend.kg ? Number(spend.kg) : null,
                    batchId: !isFeed && spend.batchId ? spend.batchId : null,
                    note: spend.note || undefined,
                  }),
                () => setSpend({ ...empty, date: spend.date, kind: spend.kind, batchId: spend.batchId })
              )
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
            {isFeed ? (
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t("feedKgBought")}
                <Input type="number" min={0} step="0.5" inputMode="decimal" value={spend.kg} onChange={(e) => setSpend({ ...spend, kg: e.target.value })} className="h-11 font-normal tabular-nums" />
                <span className="text-xs font-normal text-muted-foreground">{t("feedKgHint")}</span>
              </label>
            ) : (
              poultry && batchOptions.length > 0 && (
                <label className="flex flex-col gap-1.5 text-sm font-semibold">
                  {t("forBatch")}
                  <select value={spend.batchId} onChange={(e) => setSpend({ ...spend, batchId: e.target.value })} className="h-11 rounded-md border bg-background px-3 font-normal">
                    <option value="">{t("wholeFarm")}</option>
                    {batchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )
            )}
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
                  {(e.quantityKg != null || e.batchName || e.note) && (
                    <div className="truncate text-sm text-muted-foreground">{[e.quantityKg != null && `${e.quantityKg} kg`, e.batchName, e.note].filter(Boolean).join(" · ")}</div>
                  )}
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
