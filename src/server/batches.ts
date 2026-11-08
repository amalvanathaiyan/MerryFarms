import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { batchMoney, batchStatus, checkBatch, checkBatchDay, feedStore, outOnDay, type BatchDayRow, type BatchInfo, type BatchLossRow } from "@/domain/batches"
import { OrderError } from "./orders"
import { planNewBatch } from "./vaccinations"

/** Everything about a farm's batches; a small farm has a few batches and a few hundred day rows, so all of it at once. */
export async function loadBatches(tenantId: string) {
  const db = tenantDb(tenantId)
  const [batches, days, losses] = await Promise.all([
    db.batch.findMany({ orderBy: { number: "desc" } }),
    db.batchDay.findMany({ orderBy: { date: "asc" } }),
    db.batchLoss.findMany({ orderBy: { date: "asc" } }),
  ])
  return { batches, days, losses }
}

/**
 * Every batch as it stood at the end of `asOf`: its status and its own money, plus the feed store then.
 * Feed is priced at the average of all feed bought with its kg up to that day.
 */
export async function batchBook(tenantId: string, asOf: string) {
  const db = tenantDb(tenantId)
  const [{ batches, days, losses }, feedBuys, batchSpend] = await Promise.all([
    loadBatches(tenantId),
    db.expense.findMany({ where: { kind: "feed", date: { lte: asOf } }, select: { quantityKg: true, amountPaise: true } }),
    db.expense.findMany({ where: { batchId: { not: null }, date: { lte: asOf } }, select: { batchId: true, kind: true, amountPaise: true } }),
  ])
  const dayRows = days.map(asDay)
  const lossRows = losses.map(asLoss)
  const feed = feedStore(
    feedBuys,
    dayRows.filter((d) => d.date <= asOf).reduce((a, d) => a + (d.feedKg ?? 0), 0)
  )
  const rows = batches.map((batch) => {
    const info = asInfo(batch)
    const status = batchStatus(info, dayRows, lossRows, asOf)
    const money = batchMoney(info, status, batchSpend.filter((e) => e.batchId === batch.id), feed.pricePerKgPaise)
    return { batch, info, status, money }
  })
  return { rows, days: dayRows, losses: lossRows, feed, notes: days }
}

/** Rows shaped for src/domain/batches.ts. */
export const asDay = (d: BatchDayRow): BatchDayRow => ({ batchId: d.batchId, date: d.date, feedKg: d.feedKg, eggsCollected: d.eggsCollected, eggsBroken: d.eggsBroken, sold: d.sold, soldPaise: d.soldPaise, given: d.given })
export const asLoss = (l: BatchLossRow): BatchLossRow => ({ batchId: l.batchId, date: l.date, cause: l.cause, count: l.count })

export const asInfo = (b: BatchInfo): BatchInfo => ({
  id: b.id,
  number: b.number,
  name: b.name,
  purpose: b.purpose,
  source: b.source,
  startDate: b.startDate,
  ageAtStartDays: b.ageAtStartDays,
  startCount: b.startCount,
  closedDate: b.closedDate,
  eggValuePaise: b.eggValuePaise,
})

export interface BatchInput {
  name: string
  breed: string | null
  purpose: string
  source: string
  supplier: string | null
  startDate: string
  ageAtStartDays: number
  startCount: number
  eggsSet: number | null
  parentBatchId: string | null
  eggValuePaise: number | null
  note: string | null
}

/** Birds that have left a batch so far, and its first entry, for checking a change to the batch. */
async function entriesOf(tenantId: string, batchId: string) {
  const db = tenantDb(tenantId)
  const [days, losses] = await Promise.all([db.batchDay.findMany({ where: { batchId } }), db.batchLoss.findMany({ where: { batchId } })])
  const dates = [...days.map((d) => d.date), ...losses.map((l) => l.date)].sort()
  const outSoFar = days.reduce((a, d) => a + d.sold + d.given, 0) + losses.reduce((a, l) => a + l.count, 0)
  return { outSoFar, firstEntry: dates[0] ?? null, count: dates.length }
}

/**
 * Adds a batch with the next number. Bought chicks with a price also go in as a "chicks" expense on the batch,
 * dated its first day, so the batch's cost and the farm's profit both include them. The batch also gets its
 * vaccine doses from the farm's plan.
 */
export async function createBatch(tenantId: string, staffId: string, input: BatchInput & { chicksCostPaise: number | null }, today: string) {
  const problem = checkBatch(input, today)
  if (problem) throw new OrderError(problem)
  const db = tenantDb(tenantId)
  if (input.parentBatchId && !(await db.batch.findFirst({ where: { id: input.parentBatchId }, select: { id: true } }))) throw new OrderError("batch_not_found")
  const { chicksCostPaise, ...data } = input
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const last = await tx.batch.findFirst({ orderBy: { number: "desc" }, select: { number: true } })
        const number = (last?.number ?? 0) + 1
        const batch = await tx.batch.create({ data: { ...data, tenantId, number, name: data.name || `#${number}` } })
        if (input.source === "bought" && chicksCostPaise && chicksCostPaise > 0) {
          await tx.expense.create({ data: { tenantId, date: input.startDate, kind: "chicks", amountPaise: chicksCostPaise, batchId: batch.id, note: input.supplier, byStaffId: staffId } })
        }
        await planNewBatch(tx, tenantId, batch)
        return batch
      })
    } catch (e) {
      // Two batches added at the same moment can pick the same number; try again with the next one.
      if ((e as { code?: string }).code === "P2002" && attempt < 3) continue
      throw e
    }
  }
}

export async function updateBatch(tenantId: string, id: string, input: BatchInput, today: string) {
  const db = tenantDb(tenantId)
  const batch = await db.batch.findFirst({ where: { id } })
  if (!batch) throw new OrderError("batch_not_found")
  const existing = await entriesOf(tenantId, id)
  const problem = checkBatch(input, today, existing)
  if (problem) throw new OrderError(problem)
  if (input.parentBatchId === id) throw new OrderError("record_invalid")
  await db.batch.updateMany({ where: { id }, data: { ...input, name: input.name || `#${batch.number}` } })
}

/** Closing marks the batch finished from that day (all sold or gone); entries after it are refused. Null reopens. */
export async function setBatchClosed(tenantId: string, id: string, closedDate: string | null, today: string) {
  const db = tenantDb(tenantId)
  const batch = await db.batch.findFirst({ where: { id } })
  if (!batch) throw new OrderError("batch_not_found")
  if (closedDate) {
    if (closedDate > today) throw new OrderError("record_future")
    if (closedDate < batch.startDate) throw new OrderError("batch_before_start")
    const later = await db.batchDay.findFirst({ where: { batchId: id, date: { gt: closedDate } }, select: { id: true } })
    const laterLoss = await db.batchLoss.findFirst({ where: { batchId: id, date: { gt: closedDate } }, select: { id: true } })
    if (later || laterLoss) throw new OrderError("batch_entries_after_close")
  }
  await db.batch.updateMany({ where: { id }, data: { closedDate } })
}

/** The words typed to confirm deleting a batch match its name (spaces and capitals don't matter). */
export const namesMatch = (typed: string, name: string) => typed.trim().replace(/\s+/g, " ").toLowerCase() === name.trim().replace(/\s+/g, " ").toLowerCase()

/**
 * Deletes a batch. One with nothing entered goes at once (added by mistake). One with days entered (a test or a
 * duplicate) needs its name typed to confirm, and takes its days, losses and vaccinations with it. Its own costs
 * (chicks, its medicine) go too, or stay as farm-wide costs when `keepCosts`.
 */
export async function deleteBatch(tenantId: string, id: string, opts: { confirmName?: string; keepCosts?: boolean } = {}) {
  const db = tenantDb(tenantId)
  const batch = await db.batch.findFirst({ where: { id } })
  if (!batch) throw new OrderError("batch_not_found")
  const { count } = await entriesOf(tenantId, id)
  if (count > 0 && !namesMatch(opts.confirmName ?? "", batch.name)) throw new OrderError("batch_confirm_name")
  await db.$transaction([
    opts.keepCosts ? db.expense.updateMany({ where: { batchId: id }, data: { batchId: null } }) : db.expense.deleteMany({ where: { batchId: id } }),
    // Batches hatched from this one's eggs keep their birds; they just no longer point to it.
    db.batch.updateMany({ where: { parentBatchId: id }, data: { parentBatchId: null } }),
    db.batch.deleteMany({ where: { id } }),
  ])
}

export interface BatchDayInput {
  date: string
  feedKg: number | null
  eggsCollected: number | null
  eggsBroken: number | null
  sold: number
  soldPaise: number
  given: number
  note: string | null
  losses: { cause: string; count: number }[]
}

/** Saves one day of one batch; saving the same day again replaces it, losses included. */
export async function saveBatchDay(tenantId: string, staffId: string, batchId: string, input: BatchDayInput, today: string) {
  const db = tenantDb(tenantId)
  const losses = mergeLosses(input.losses)
  await db.$transaction(async (tx) => {
    const batch = await tx.batch.findFirst({ where: { id: batchId } })
    if (!batch) throw new OrderError("batch_not_found")
    const [otherDays, otherLosses] = await Promise.all([
      tx.batchDay.findMany({ where: { batchId, date: { not: input.date } }, select: { sold: true, given: true } }),
      tx.batchLoss.findMany({ where: { batchId, date: { not: input.date } }, select: { count: true } }),
    ])
    const outOtherDays = otherDays.reduce((a, d) => a + outOnDay(d, []), 0) + otherLosses.reduce((a, l) => a + l.count, 0)
    const problem = checkBatchDay(batch, input, losses, outOtherDays, today)
    if (problem) throw new OrderError(problem)

    const { losses: _ignored, ...day } = input
    void _ignored
    await tx.batchDay.upsert({
      where: { batchId_date: { batchId, date: input.date } },
      update: { ...day, byStaffId: staffId },
      create: { ...day, tenantId, batchId, byStaffId: staffId },
    })
    // Losses are rewritten, but a cause already entered that day keeps the time it was first entered.
    const firstEntered = new Map((await tx.batchLoss.findMany({ where: { batchId, date: input.date }, select: { cause: true, createdAt: true } })).map((l) => [l.cause, l.createdAt]))
    await tx.batchLoss.deleteMany({ where: { batchId, date: input.date } })
    if (losses.length)
      await tx.batchLoss.createMany({ data: losses.map((l) => ({ ...l, tenantId, batchId, date: input.date, ...(firstEntered.has(l.cause) ? { createdAt: firstEntered.get(l.cause) } : {}) })) })
  })
}

/** One row per cause, zero counts dropped. */
export function mergeLosses(losses: { cause: string; count: number }[]) {
  const by = new Map<string, number>()
  for (const l of losses) if (l.count) by.set(l.cause, (by.get(l.cause) ?? 0) + l.count)
  return [...by.entries()].map(([cause, count]) => ({ cause, count }))
}
