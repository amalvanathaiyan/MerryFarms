import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { saveBatchDay, type BatchDayInput } from "./batches"
import { saveWeight } from "./weights"
import { addDose, giveDose } from "./vaccinations"
import { OrderError } from "./orders"
import { audit, type Actor } from "./audit"

/** A part of the Entry page's one Save. */
export type EntryPart = "day" | "weight" | "dose"

/**
 * One batch's entry for one day, from the Entry page: any of the day's numbers, a weighing, doses that were due and
 * are now given, and a dose that was never planned. Only the parts filled in are sent.
 */
export interface BatchEntryInput {
  date: string
  day?: Omit<BatchDayInput, "date">
  weight?: { birds: number; totalGrams: number; note: string | null }
  /** Doses already planned for this batch, given on this day. costPaise undefined leaves any cost as it is. */
  give?: { doseId: string; birds: number | null; costPaise: number | null | undefined }[]
  /** A dose given on this day that wasn't planned. */
  newDose?: { vaccine: string; method: string | null; birds: number | null; costPaise: number | null | undefined }
}

export interface BatchEntryResult {
  saved: EntryPart[]
  /** The part that couldn't be saved (and why); parts after it weren't tried. */
  failed: { part: EntryPart; code: string } | null
}

/**
 * Saves the parts in order: the day, the weighing, the doses. Each part keeps its own checks and transaction, so a
 * part that fails stops the rest, and the result says exactly what was saved, never more.
 */
export async function saveBatchEntry(tenantId: string, actor: Actor & { id: string }, batchId: string, input: BatchEntryInput, today: string, eggsToStore = false): Promise<BatchEntryResult> {
  const db = tenantDb(tenantId)
  const batch = await db.batch.findFirst({ where: { id: batchId }, select: { id: true } })
  if (!batch) throw new OrderError("batch_not_found")
  const saved: EntryPart[] = []
  let failed: BatchEntryResult["failed"] = null
  const step = async (part: EntryPart, fn: () => Promise<unknown>) => {
    try {
      await fn()
      if (!saved.includes(part)) saved.push(part)
      return true
    } catch (e) {
      if (!(e instanceof OrderError)) throw e
      failed = { part, code: e.code }
      return false
    }
  }

  const run = async () => {
    if (input.day && !(await step("day", () => saveBatchDay(tenantId, actor.id, batchId, { ...input.day!, date: input.date }, today, eggsToStore)))) return
    if (input.weight && !(await step("weight", () => saveWeight(tenantId, actor.id, batchId, { date: input.date, ...input.weight! }, today)))) return
    if (input.give?.length) {
      // Only doses of this batch: an id from another batch (or farm) is refused, not given.
      const mine = new Set((await db.batchVaccination.findMany({ where: { batchId, id: { in: input.give.map((g) => g.doseId) } }, select: { id: true } })).map((d) => d.id))
      for (const g of input.give) {
        const ok = await step("dose", async () => {
          if (!mine.has(g.doseId)) throw new OrderError("vaccine_not_found")
          await giveDose(tenantId, actor.id, g.doseId, { givenDate: input.date, birds: g.birds, costPaise: g.costPaise, note: null }, today)
        })
        if (!ok) return
      }
    }
    if (input.newDose) {
      const d = input.newDose
      await step("dose", () => addDose(tenantId, actor.id, batchId, { vaccine: d.vaccine, method: d.method, dueDate: null, givenDate: input.date, birds: d.birds, costPaise: d.costPaise, note: null }, today))
    }
  }
  await run()

  if (saved.length) await audit(actor, [{ tenantId, action: "poultry.entry", subject: batchId, after: { date: input.date, saved, doses: (input.give?.length ?? 0) + (input.newDose ? 1 : 0) } }])
  return { saved, failed }
}
