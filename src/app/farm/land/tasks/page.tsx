import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import { landTabs } from "@/lib/farm-sections"
import { dayLabel } from "@/lib/i18n-helpers"
import { addDays, istDate } from "@/domain/ist"
import { repeats, taskState, type TaskState } from "@/domain/tasks"
import { cn } from "@/lib/utils"
import { SectionHeader } from "@/components/farm/section-header"
import { AddTask, DoneButton, TaskActions, type TaskChoices } from "@/components/farm/task-forms"

const DONE_SHOWN_DAYS = 30

/**
 * My farm · Jobs: what's to do now (late and today, each with Done), this week, later; one-off jobs done lately are
 * folded at the end. Each job opens to change or remove it. Due jobs also show on Today.
 */
export default async function TasksPage() {
  const { db } = await requireStaff(["owner", "manager"])
  const t = await getTranslations("farm.tasks")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const today = istDate(new Date())
  const [tasks, places, assets, staff] = await Promise.all([
    db.farmTask.findMany({ where: { OR: [{ doneOn: null }, { doneOn: { gte: addDays(today, -DONE_SHOWN_DAYS) } }] }, orderBy: [{ dueOn: "asc" }, { createdAt: "asc" }] }),
    db.farmPlace.findMany({ where: { retiredAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } }),
    db.farmAsset.findMany({ where: { retiredAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.staffMember.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  const choices: TaskChoices = { places, assets, staff }
  const day = (d: string) => dayLabel(d, locale, { today: tc("today"), tomorrow: tc("tomorrow") })
  const nameOf = (list: { id: string; name: string }[], id: string | null) => (id ? (list.find((x) => x.id === id)?.name ?? null) : null)
  const withState = tasks.map((task) => ({ task, state: taskState(task, today) }))
  const groups: { key: string; states: TaskState[] }[] = [
    { key: "now", states: ["late", "today"] },
    { key: "soon", states: ["soon"] },
    { key: "later", states: ["later"] },
  ]

  const item = ({ task, state }: (typeof withState)[number]) => {
    const meta = [
      state === "done"
        ? t("doneLine", { day: day(task.doneOn!) })
        : state === "late"
          ? t("lateLine", { day: day(task.dueOn) })
          : day(task.dueOn),
      repeats(task) && t(`repeatLine_${task.repeatUnit}`, { count: task.repeatEvery! }),
      nameOf(places, task.placeId),
      nameOf(assets, task.assetId),
      task.forStaffId && t("forPerson", { name: nameOf(staff, task.forStaffId) ?? "—" }),
    ].filter(Boolean)
    return (
      <li key={task.id} className={cn("flex items-start gap-2 rounded-2xl border bg-card p-3", state === "late" && "border-destructive/50")}>
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer list-none">
            <span className={cn("block font-bold", state === "done" && "text-muted-foreground line-through")}>{task.title}</span>
            <span className={cn("block text-sm", state === "late" ? "font-semibold text-destructive" : "text-muted-foreground")}>{meta.join(" · ")}</span>
          </summary>
          <div className="flex flex-col gap-2 pt-3">
            {task.note && <p className="text-sm whitespace-pre-line">{task.note}</p>}
            {task.lastDoneOn && state !== "done" && <p className="text-sm text-muted-foreground">{t("lastDoneLine", { day: day(task.lastDoneOn) })}</p>}
            <TaskActions task={task} choices={choices} today={today} done={state === "done"} />
          </div>
        </details>
        {(state === "late" || state === "today") && <DoneButton id={task.id} />}
      </li>
    )
  }

  const done = withState.filter((x) => x.state === "done")
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="land" tabs={landTabs()} active="tasks" back={{ href: "/farm/more" }} />
      {tasks.length === 0 && <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{t("none")}</p>}
      <AddTask choices={choices} today={today} />
      {groups.map((g) => {
        const rows = withState.filter((x) => g.states.includes(x.state))
        return rows.length === 0 ? null : (
          <section key={g.key} className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{t(`group_${g.key}`)}</h2>
            <ul className="flex flex-col gap-2">{rows.map(item)}</ul>
          </section>
        )
      })}
      {done.length > 0 && (
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">{t("doneTitle", { count: done.length })}</summary>
          <ul className="flex flex-col gap-2 p-3">{done.map(item)}</ul>
        </details>
      )}
    </div>
  )
}
