"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { markDaysAction, payWorkerAction, removePaymentAction, saveWorkerAction, setWorkerLeftAction } from "@/app/actions/workers"
import { DAY_STATES } from "@/domain/workers"
import { formatRupees } from "@/domain/money"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

const field = "flex flex-col gap-1.5 text-sm font-semibold"
const chip = (on: boolean, tone?: string) => cn("min-h-11 flex-1 rounded-xl border-2 px-2 text-sm font-semibold", on ? (tone ?? "border-primary bg-accent") : "bg-card hover:border-primary")
const STATE_TONE: Record<string, string> = { present: "border-primary bg-primary text-primary-foreground", half: "border-yolk bg-yolk text-yolk-foreground", absent: "border-muted-foreground bg-muted" }

function useRun() {
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void, kind: "settings" | "payment" = "settings") =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      after?.()
      cheer(kind)
      router.refresh()
    })
  return { pending, error, run }
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {text}
    </p>
  ) : null
}

type Place = { id: string; name: string }
export interface AttendanceRow {
  id: string
  name: string
  role: string | null
  state: string | null
  placeId: string | null
}

/**
 * One day's attendance for every worker: Present, Half day or Absent (tap again to clear), and where they worked.
 * "Everyone present" fills the rest in one tap; one Save sends the whole day.
 */
export function AttendanceForm({ date, rows, places }: { date: string; rows: AttendanceRow[]; places: Place[] }) {
  const t = useTranslations("farm.workers")
  const [marks, setMarks] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { state: r.state, placeId: r.placeId ?? "" }])))
  const [saved, setSaved] = useState(false)
  const { pending, error, run } = useRun()
  const set = (id: string, v: Partial<{ state: string | null; placeId: string }>) => {
    setMarks((m) => ({ ...m, [id]: { ...m[id], ...v } }))
    setSaved(false)
  }
  const unmarked = rows.filter((r) => !marks[r.id].state).length
  return (
    <section className="flex flex-col gap-3">
      {unmarked > 0 && (
        <Button type="button" variant="outline" className="h-11 self-start" onClick={() => rows.forEach((r) => !marks[r.id].state && set(r.id, { state: "present" }))}>
          {t("allPresent", { count: unmarked })}
        </Button>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => {
          const m = marks[r.id]
          return (
            <li key={r.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
              <div className="font-bold">
                {r.name}
                {r.role && <span className="font-normal text-muted-foreground"> · {r.role}</span>}
              </div>
              <div className="flex gap-1.5" role="group" aria-label={r.name}>
                {DAY_STATES.map((s) => (
                  <button key={s} type="button" aria-pressed={m.state === s} className={chip(m.state === s, STATE_TONE[s])} onClick={() => set(r.id, { state: m.state === s ? null : s })}>
                    {t(`state_${s}`)}
                  </button>
                ))}
              </div>
              {places.length > 0 && m.state && m.state !== "absent" && (
                <select value={m.placeId} onChange={(e) => set(r.id, { placeId: e.target.value })} aria-label={t("workedAt")} className="h-11 rounded-md border bg-background px-3 text-sm">
                  <option value="">{t("workedAtFarm")}</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {t("workedAtPlace", { place: p.name })}
                    </option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>
      <ErrorLine text={error} />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1"
          disabled={pending}
          onClick={() =>
            run(
              () => markDaysAction({ date, entries: rows.map((r) => ({ workerId: r.id, state: marks[r.id].state, placeId: marks[r.id].state && marks[r.id].state !== "absent" && marks[r.id].placeId ? marks[r.id].placeId : null })) }),
              () => setSaved(true)
            )
          }
        >
          {t("saveDay")}
        </Button>
        {saved && (
          <span role="status" className="font-medium text-primary">
            {t("saved")}
          </span>
        )}
      </div>
    </section>
  )
}

export interface WorkerRow {
  id: string
  name: string
  phone: string | null
  role: string | null
  payType: string
  ratePaise: number
  joinedOn: string | null
  notes: string | null
}

export function WorkerForm({ worker, today, onDone }: { worker: WorkerRow | null; today: string; onDone: () => void }) {
  const t = useTranslations("farm.workers")
  const [f, setF] = useState({
    name: worker?.name ?? "",
    phone: worker?.phone ?? "",
    role: worker?.role ?? "",
    payType: worker?.payType ?? "daily",
    rate: worker ? String(worker.ratePaise / 100) : "",
    joinedOn: worker?.joinedOn ?? "",
    notes: worker?.notes ?? "",
  })
  const { pending, error, run } = useRun()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            saveWorkerAction({
              id: worker?.id ?? null,
              name: f.name,
              phone: f.phone.trim() || null,
              role: f.role.trim() || null,
              payType: f.payType,
              rateRupees: Number(f.rate),
              joinedOn: f.joinedOn || null,
              notes: f.notes.trim() || null,
            }),
          onDone
        )
      }}
    >
      <label className={field}>
        {t("name")}
        <Input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-12 font-normal" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("phone")}
          <Input type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="h-12 font-normal" />
        </label>
        <label className={field}>
          {t("role")}
          <Input maxLength={40} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder={t("rolePlaceholder")} className="h-12 font-normal" />
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("payType")}</legend>
        <div className="flex gap-2">
          {(["daily", "monthly"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={f.payType === p} className={chip(f.payType === p)} onClick={() => setF({ ...f, payType: p })}>
              {t(`pay_${p}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className={field}>
        {f.payType === "monthly" ? t("ratePerMonth") : t("ratePerDay")}
        <Input required type="number" min={1} step="any" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} className="h-12 max-w-40 font-normal tabular-nums" />
        {f.payType === "monthly" && <span className="text-xs font-normal text-muted-foreground">{t("monthlyHint")}</span>}
      </label>
      <label className={field}>
        {t("joinedOn")}
        <Input type="date" max={today} value={f.joinedOn} onChange={(e) => setF({ ...f, joinedOn: e.target.value })} className="h-12 max-w-48 font-normal" />
      </label>
      <label className={field}>
        {t("notes")}
        <textarea rows={2} maxLength={300} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className="rounded-xl border bg-card px-3 py-2 text-base font-normal" />
      </label>
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending || !(Number(f.rate) > 0)}>
          {worker ? t("save") : t("addWorker")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

export function AddWorker({ today }: { today: string }) {
  const t = useTranslations("farm.workers")
  const [open, setOpen] = useState(false)
  return open ? (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <WorkerForm worker={null} today={today} onDone={() => setOpen(false)} />
    </section>
  ) : (
    <Button type="button" variant="outline" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
      <Plus aria-hidden /> {t("addWorker")}
    </Button>
  )
}

/** Paying a worker: wage or advance, how much (what's owed to start with), the day, a note. */
export function PayForm({ workerId, owedPaise, today }: { workerId: string; owedPaise: number; today: string }) {
  const t = useTranslations("farm.workers")
  const [p, setP] = useState({ kind: owedPaise > 0 ? "wage" : "advance", amount: owedPaise > 0 ? String(owedPaise / 100) : "", date: today, note: "" })
  const { pending, error, run } = useRun()
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => payWorkerAction({ workerId, date: p.date, kind: p.kind, amountRupees: Number(p.amount), note: p.note.trim() || null }), () => setP({ ...p, amount: "", note: "" }), "payment")
      }}
    >
      <h2 className="text-lg font-bold">{t("payTitle")}</h2>
      <div className="flex gap-2">
        {(["wage", "advance"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={p.kind === k} className={chip(p.kind === k)} onClick={() => setP({ ...p, kind: k })}>
            {t(`kind_${k}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("amount")}
          <Input required type="number" min={1} step="any" inputMode="decimal" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
        <label className={field}>
          {t("date")}
          <Input type="date" max={today} value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} className="h-12 font-normal" />
        </label>
      </div>
      <Input maxLength={80} value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} placeholder={t("payNote")} className="h-11" />
      <p className="text-xs text-muted-foreground">{t("payHint")}</p>
      <ErrorLine text={error} />
      <Button type="submit" size="lg" className="h-12" disabled={pending || !(Number(p.amount) > 0)}>
        {p.amount && Number(p.amount) > 0 ? t("payAmount", { amount: formatRupees(Math.round(Number(p.amount) * 100)) }) : t("pay")}
      </Button>
    </form>
  )
}

export function RemovePayment({ id }: { id: string }) {
  const t = useTranslations("farm.workers")
  const [armed, setArmed] = useState(false)
  const { pending, run } = useRun()
  return armed ? (
    <Button type="button" variant="destructive" size="sm" className="h-9" disabled={pending} onClick={() => run(() => removePaymentAction(id))}>
      {t("removeSure")}
    </Button>
  ) : (
    <button type="button" className="grid size-9 place-items-center rounded-lg text-muted-foreground" aria-label={t("removePayment")} onClick={() => setArmed(true)}>
      <Trash2 className="size-4" />
    </button>
  )
}

/** Change a worker's details, or mark that they stopped working here (or came back). */
export function WorkerActions({ worker, left, today }: { worker: WorkerRow; left: boolean; today: string }) {
  const t = useTranslations("farm.workers")
  const [editing, setEditing] = useState(false)
  const { pending, error, run } = useRun()
  if (editing) return <WorkerForm worker={worker} today={today} onDone={() => setEditing(false)} />
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {!left && (
          <Button type="button" variant="outline" className="h-10" onClick={() => setEditing(true)}>
            {t("change")}
          </Button>
        )}
        <Button type="button" variant="ghost" className="h-10" disabled={pending} onClick={() => run(() => setWorkerLeftAction(worker.id, left ? null : today))}>
          {left ? t("cameBack") : t("left")}
        </Button>
      </div>
      <ErrorLine text={error} />
    </div>
  )
}
