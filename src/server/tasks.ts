import "server-only"
import type { TenantDb } from "@/lib/tenant-db"
import { istDate } from "@/domain/ist"
import { farmReminders, nextDue, REPEAT_UNITS, repeats } from "@/domain/tasks"
import { OrderError } from "./orders"
import { storeList } from "./inputs"

/**
 * Farm Core's jobs for one farm, through its tenant-scoped client. Rules are in src/domain/tasks.ts.
 */

export interface TaskForm {
  title: string
  note: string | null
  dueOn: string
  repeatEvery: number | null
  repeatUnit: string | null
  placeId: string | null
  assetId: string | null
  forStaffId: string | null
}

/** Adds or changes a job. Its place, machine and person must be the farm's own. */
export async function saveTask(db: TenantDb, tenantId: string, id: string | null, f: TaskForm, byStaffId: string) {
  const repeating = repeats(f)
  if (f.repeatUnit && !(REPEAT_UNITS as readonly string[]).includes(f.repeatUnit)) throw new OrderError("invalid_form")
  const [place, asset, person] = await Promise.all([
    f.placeId ? db.farmPlace.findFirst({ where: { id: f.placeId }, select: { id: true } }) : true,
    f.assetId ? db.farmAsset.findFirst({ where: { id: f.assetId }, select: { id: true } }) : true,
    f.forStaffId ? db.staffMember.findFirst({ where: { id: f.forStaffId, isActive: true }, select: { id: true } }) : true,
  ])
  if (!place || !asset || !person) throw new OrderError("not_found")
  const data = {
    title: f.title.trim(),
    note: f.note?.trim() || null,
    dueOn: f.dueOn,
    repeatEvery: repeating ? f.repeatEvery : null,
    repeatUnit: repeating ? f.repeatUnit : null,
    placeId: f.placeId,
    assetId: f.assetId,
    forStaffId: f.forStaffId,
  }
  if (id) {
    const r = await db.farmTask.updateMany({ where: { id }, data })
    if (r.count !== 1) throw new OrderError("not_found")
    return id
  }
  return (await db.farmTask.create({ data: { ...data, tenantId, byStaffId } })).id
}

export async function removeTask(db: TenantDb, id: string) {
  const r = await db.farmTask.deleteMany({ where: { id } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/**
 * Done today. A one-off job is marked done; a repeating one moves on to its next day. Someone else's job can only
 * be done by them, the owner or a manager.
 */
export async function markTaskDone(db: TenantDb, id: string, staff: { id: string; roles: readonly string[] }) {
  const t = await db.farmTask.findFirst({ where: { id } })
  if (!t || t.doneOn) throw new OrderError("not_found")
  const boss = staff.roles.some((r) => r === "owner" || r === "manager")
  if (!boss && t.forStaffId !== staff.id) throw new OrderError("not_found")
  const today = istDate(new Date())
  const data = repeats(t) ? { dueOn: nextDue(t, today), lastDoneOn: today, lastDoneBy: staff.id } : { doneOn: today, lastDoneOn: today, lastDoneBy: staff.id }
  await db.farmTask.updateMany({ where: { id, updatedAt: t.updatedAt }, data })
}

/** A one-off job marked done by mistake goes back to the list. */
export async function undoTask(db: TenantDb, id: string) {
  const r = await db.farmTask.updateMany({ where: { id, doneOn: { not: null } }, data: { doneOn: null } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/**
 * Today's reminders from the farm's own records (machines due for a service, the store running low). feedWarned:
 * the hens' "feed running out" warning is already showing.
 */
export async function remindersFor(db: TenantDb, today: string, feedWarned: boolean) {
  const [assets, store] = await Promise.all([
    db.farmAsset.findMany({ where: { retiredAt: null, serviceEveryDays: { not: null } }, select: { id: true, name: true, serviceEveryDays: true, lastServiceOn: true, boughtOn: true, retiredAt: true } }),
    storeList(db, today),
  ])
  return farmReminders(assets, store, today, feedWarned)
}
