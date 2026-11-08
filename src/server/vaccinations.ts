import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { checkDose, checkScheduleItem, planFor, type ScheduleItem } from "@/domain/vaccinations"
import { OrderError } from "./orders"

type Db = ReturnType<typeof tenantDb>
type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0]

export const loadSchedule = (tenantId: string) => tenantDb(tenantId).vaccineScheduleItem.findMany({ orderBy: [{ ageDays: "asc" }, { createdAt: "asc" }] })

export async function addScheduleItem(tenantId: string, item: ScheduleItem) {
  const problem = checkScheduleItem(item)
  if (problem) throw new OrderError(problem)
  const db = tenantDb(tenantId)
  const same = await db.vaccineScheduleItem.findFirst({ where: { vaccine: { equals: item.vaccine.trim(), mode: "insensitive" }, ageDays: item.ageDays }, select: { id: true } })
  if (same) throw new OrderError("vaccine_in_plan")
  await db.vaccineScheduleItem.create({ data: { tenantId, vaccine: item.vaccine.trim(), ageDays: item.ageDays, method: item.method } })
}

export async function deleteScheduleItem(tenantId: string, id: string) {
  await tenantDb(tenantId).vaccineScheduleItem.deleteMany({ where: { id } })
}

/** Inside a new batch's transaction: its doses from the farm's plan. */
export async function planNewBatch(tx: Tx, tenantId: string, batch: { id: string; startDate: string; ageAtStartDays: number }) {
  const schedule = await tx.vaccineScheduleItem.findMany({ where: { tenantId } })
  const plan = planFor(batch, schedule)
  if (plan.length) await tx.batchVaccination.createMany({ data: plan.map((p) => ({ ...p, tenantId, batchId: batch.id })) })
}

/**
 * Adds the farm's plan to a batch that came before the plan was set: only doses from today on (earlier ones were
 * given or missed already, and can be entered by hand), and none the batch already has on the same day.
 */
export async function applyScheduleToBatch(tenantId: string, batchId: string, today: string) {
  const db = tenantDb(tenantId)
  const batch = await db.batch.findFirst({ where: { id: batchId } })
  if (!batch) throw new OrderError("batch_not_found")
  const [schedule, existing] = await Promise.all([loadSchedule(tenantId), db.batchVaccination.findMany({ where: { batchId } })])
  const have = new Set(existing.map((v) => `${v.vaccine.toLowerCase()}|${v.dueDate}`))
  const plan = planFor(batch, schedule).filter((p) => p.dueDate >= today && !have.has(`${p.vaccine.toLowerCase()}|${p.dueDate}`))
  if (plan.length) await db.batchVaccination.createMany({ data: plan.map((p) => ({ ...p, tenantId, batchId })) })
  return plan.length
}

export interface DoseInput {
  vaccine: string
  method: string | null
  dueDate: string | null
  givenDate: string | null
  birds: number | null
  /** undefined leaves any cost already on the dose as it is (staff who can't see money). */
  costPaise: number | null | undefined
  note: string | null
}

/** The dose's medicine expense on its batch: created, changed or removed to match its cost. */
async function syncExpense(tx: Tx, tenantId: string, staffId: string, dose: { id: string; batchId: string; vaccine: string; givenDate: string | null; expenseId: string | null }, costPaise: number | null | undefined) {
  if (costPaise === undefined && dose.givenDate) {
    // Keep the cost, but follow the day it was given.
    if (dose.expenseId) await tx.expense.updateMany({ where: { id: dose.expenseId }, data: { date: dose.givenDate } })
    return
  }
  const want = dose.givenDate && costPaise ? costPaise : 0
  if (!want) {
    if (dose.expenseId) {
      await tx.expense.deleteMany({ where: { id: dose.expenseId } })
      await tx.batchVaccination.updateMany({ where: { id: dose.id }, data: { expenseId: null } })
    }
    return
  }
  const data = { date: dose.givenDate!, amountPaise: want, note: dose.vaccine }
  if (dose.expenseId && (await tx.expense.updateMany({ where: { id: dose.expenseId }, data })).count > 0) return
  const e = await tx.expense.create({ data: { ...data, tenantId, kind: "medicine", batchId: dose.batchId, byStaffId: staffId } })
  await tx.batchVaccination.updateMany({ where: { id: dose.id }, data: { expenseId: e.id } })
}

/** Plans a dose, or enters one already given. */
export async function addDose(tenantId: string, staffId: string, batchId: string, input: DoseInput, today: string) {
  const db = tenantDb(tenantId)
  await db.$transaction(async (tx) => {
    const batch = await tx.batch.findFirst({ where: { id: batchId, tenantId } })
    if (!batch) throw new OrderError("batch_not_found")
    const problem = checkDose(batch, { ...input, costPaise: input.costPaise ?? null }, today)
    if (problem) throw new OrderError(problem)
    const { costPaise, ...data } = input
    const dose = await tx.batchVaccination.create({ data: { ...data, vaccine: data.vaccine.trim(), tenantId, batchId, byStaffId: data.givenDate ? staffId : null } })
    await syncExpense(tx, tenantId, staffId, dose, costPaise)
  })
}

/** Marks a dose given (or changes how it was given). */
export async function giveDose(tenantId: string, staffId: string, id: string, input: Pick<DoseInput, "givenDate" | "birds" | "costPaise" | "note">, today: string) {
  const db = tenantDb(tenantId)
  await db.$transaction(async (tx) => {
    const dose = await tx.batchVaccination.findFirst({ where: { id, tenantId }, include: { batch: true } })
    if (!dose) throw new OrderError("vaccine_not_found")
    if (!input.givenDate) throw new OrderError("vaccine_day_required")
    const problem = checkDose(dose.batch, { vaccine: dose.vaccine, method: dose.method, dueDate: dose.dueDate, givenDate: input.givenDate, birds: input.birds, costPaise: input.costPaise ?? null }, today)
    if (problem) throw new OrderError(problem)
    await tx.batchVaccination.updateMany({ where: { id }, data: { givenDate: input.givenDate, birds: input.birds, note: input.note, byStaffId: staffId } })
    await syncExpense(tx, tenantId, staffId, { ...dose, givenDate: input.givenDate }, input.costPaise)
  })
}

/** Takes back "given": a planned dose goes back to planned (its cost removed); one never planned is removed. */
export async function undoDose(tenantId: string, id: string) {
  const db = tenantDb(tenantId)
  await db.$transaction(async (tx) => {
    const dose = await tx.batchVaccination.findFirst({ where: { id, tenantId } })
    if (!dose) throw new OrderError("vaccine_not_found")
    if (dose.expenseId) await tx.expense.deleteMany({ where: { id: dose.expenseId, tenantId } })
    if (!dose.dueDate) await tx.batchVaccination.deleteMany({ where: { id, tenantId } })
    else await tx.batchVaccination.updateMany({ where: { id, tenantId }, data: { givenDate: null, birds: null, expenseId: null, byStaffId: null } })
  })
}

/** Removes a dose from the batch, with its cost. */
export async function deleteDose(tenantId: string, id: string) {
  const db = tenantDb(tenantId)
  await db.$transaction(async (tx) => {
    const dose = await tx.batchVaccination.findFirst({ where: { id, tenantId } })
    if (!dose) return
    if (dose.expenseId) await tx.expense.deleteMany({ where: { id: dose.expenseId, tenantId } })
    await tx.batchVaccination.deleteMany({ where: { id, tenantId } })
  })
}
