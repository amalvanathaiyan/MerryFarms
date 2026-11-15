"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { markTaskDoneAction, removeTaskAction, saveTaskAction, undoTaskAction } from "@/app/actions/tasks"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"

const field = "flex flex-col gap-1.5 text-sm font-semibold"
const select = "h-12 rounded-md border bg-background px-3 text-base font-normal"
const chip = (on: boolean) => cn("min-h-11 flex-1 rounded-xl border-2 px-2 text-sm font-semibold", on ? "border-primary bg-accent" : "bg-card hover:border-primary")
const REPEATS = ["once", "day", "week", "month"] as const

function useRun() {
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      after?.()
      cheer("settings")
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

type Option = { id: string; name: string }
export interface TaskChoices {
  places: Option[]
  assets: Option[]
  staff: Option[]
}
export interface TaskRow {
  id: string
  title: string
  note: string | null
  dueOn: string
  repeatEvery: number | null
  repeatUnit: string | null
  placeId: string | null
  assetId: string | null
  forStaffId: string | null
}

/** A job: what, from which day, how often, and (optional) where, which machine, who sees it. */
function TaskForm({ task, choices, today, onDone }: { task: TaskRow | null; choices: TaskChoices; today: string; onDone: () => void }) {
  const t = useTranslations("farm.tasks")
  const [f, setF] = useState({
    title: task?.title ?? "",
    note: task?.note ?? "",
    dueOn: task?.dueOn ?? today,
    repeat: (task?.repeatUnit ?? "once") as (typeof REPEATS)[number],
    every: String(task?.repeatEvery ?? 1),
    placeId: task?.placeId ?? "",
    assetId: task?.assetId ?? "",
    forStaffId: task?.forStaffId ?? "",
  })
  const { pending, error, run } = useRun()
  const once = f.repeat === "once"
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(
          () =>
            saveTaskAction({
              id: task?.id ?? null,
              title: f.title,
              note: f.note.trim() || null,
              dueOn: f.dueOn,
              repeatEvery: once ? null : Math.max(1, Math.round(Number(f.every) || 1)),
              repeatUnit: once ? null : f.repeat,
              placeId: f.placeId || null,
              assetId: f.assetId || null,
              forStaffId: f.forStaffId || null,
            }),
          onDone
        )
      }}
    >
      <label className={field}>
        {t("title")}
        <Input required maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("titlePlaceholder")} className="h-12 font-normal" />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("howOften")}</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {REPEATS.map((r) => (
            <button key={r} type="button" aria-pressed={f.repeat === r} className={chip(f.repeat === r)} onClick={() => setF({ ...f, repeat: r })}>
              {t(`repeat_${r}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {once ? t("on") : t("firstOn")}
          <Input required type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} className="h-12 font-normal" />
        </label>
        {!once && (
          <label className={field}>
            {t(`every_${f.repeat}`)}
            <Input type="number" min={1} max={365} step={1} inputMode="numeric" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} className="h-12 font-normal tabular-nums" />
          </label>
        )}
      </div>
      {(choices.places.length > 0 || choices.assets.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {choices.places.length > 0 && (
            <label className={field}>
              {t("where")}
              <select value={f.placeId} onChange={(e) => setF({ ...f, placeId: e.target.value })} className={select}>
                <option value="">{t("wholeFarm")}</option>
                {choices.places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {choices.assets.length > 0 && (
            <label className={field}>
              {t("machine")}
              <select value={f.assetId} onChange={(e) => setF({ ...f, assetId: e.target.value })} className={select}>
                <option value="">{t("noMachine")}</option>
                {choices.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {choices.staff.length > 0 && (
        <label className={field}>
          {t("forWho")}
          <select value={f.forStaffId} onChange={(e) => setF({ ...f, forStaffId: e.target.value })} className={select}>
            <option value="">{t("forBosses")}</option>
            {choices.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {t("forPerson", { name: s.name })}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={field}>
        {t("note")}
        <textarea rows={2} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="rounded-xl border bg-card px-3 py-2 text-base font-normal" />
      </label>
      <ErrorLine text={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {task ? t("save") : t("addTask")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

export function AddTask({ choices, today }: { choices: TaskChoices; today: string }) {
  const t = useTranslations("farm.tasks")
  const [open, setOpen] = useState(false)
  return open ? (
    <section className="rounded-2xl border-2 border-primary bg-card p-4">
      <TaskForm task={null} choices={choices} today={today} onDone={() => setOpen(false)} />
    </section>
  ) : (
    <Button type="button" variant="outline" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
      <Plus aria-hidden /> {t("addTask")}
    </Button>
  )
}

/** The Done button, on Today and on the jobs list. */
export function DoneButton({ id, className }: { id: string; className?: string }) {
  const t = useTranslations("farm.tasks")
  const { pending, error, run } = useRun()
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button type="button" className={cn("h-11", className)} disabled={pending} onClick={() => run(() => markTaskDoneAction(id))}>
        <Check aria-hidden /> {t("done")}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}

/** Change or remove a job; a one-off done by mistake can be put back. */
export function TaskActions({ task, choices, today, done }: { task: TaskRow; choices: TaskChoices; today: string; done: boolean }) {
  const t = useTranslations("farm.tasks")
  const [editing, setEditing] = useState(false)
  const [armed, setArmed] = useState(false)
  const { pending, error, run } = useRun()
  if (editing) return <TaskForm task={task} choices={choices} today={today} onDone={() => setEditing(false)} />
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {done ? (
          <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={() => run(() => undoTaskAction(task.id))}>
            {t("notDone")}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-10" onClick={() => setEditing(true)}>
            {t("change")}
          </Button>
        )}
        {armed ? (
          <Button type="button" variant="destructive" className="h-10" disabled={pending} onClick={() => run(() => removeTaskAction(task.id))}>
            {t("removeSure")}
          </Button>
        ) : (
          <Button type="button" variant="ghost" className="h-10" onClick={() => setArmed(true)}>
            {t("remove")}
          </Button>
        )}
      </div>
      <ErrorLine text={error} />
    </div>
  )
}
