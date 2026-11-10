import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { checkWeight, type WeightRow } from "@/domain/weights"
import { OrderError } from "./orders"

/** A batch's weighings, oldest first. */
export async function loadWeights(tenantId: string, batchId: string) {
  return tenantDb(tenantId).batchWeight.findMany({ where: { batchId }, orderBy: { date: "asc" } })
}

/** Saves a weighing; weighing the same batch again on the same day replaces it (createdAt is kept). */
export async function saveWeight(tenantId: string, staffId: string, batchId: string, w: WeightRow & { note: string | null }, today: string) {
  const db = tenantDb(tenantId)
  const batch = await db.batch.findFirst({ where: { id: batchId }, select: { id: true, startDate: true, closedDate: true } })
  if (!batch) throw new OrderError("batch_not_found")
  const problem = checkWeight(batch, w, today)
  if (problem) throw new OrderError(problem)
  const data = { birds: w.birds, totalGrams: w.totalGrams, note: w.note, byStaffId: staffId }
  const existing = await db.batchWeight.findFirst({ where: { batchId, date: w.date }, select: { id: true } })
  if (existing) return db.batchWeight.update({ where: { id: existing.id }, data })
  return db.batchWeight.create({ data: { tenantId, batchId, date: w.date, ...data } })
}

export async function deleteWeight(tenantId: string, id: string) {
  const { count } = await tenantDb(tenantId).batchWeight.deleteMany({ where: { id } })
  if (!count) throw new OrderError("weight_not_found")
}
