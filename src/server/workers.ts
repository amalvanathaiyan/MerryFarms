import "server-only"
import type { TenantDb } from "@/lib/tenant-db"
import { istDate } from "@/domain/ist"
import { DAY_STATES, earned, isPayKind, owed, PAY_TYPES } from "@/domain/workers"
import { OrderError } from "./orders"

/**
 * Farm Core's workers for one farm, through its tenant-scoped client: who works here, their days, and the money
 * given to them. Rules are in src/domain/workers.ts. Each payment is also a labour expense, so wages show in Money
 * and profit without being entered twice.
 */

export interface WorkerInput {
  name: string
  phone: string | null
  role: string | null
  payType: string
  ratePaise: number
  joinedOn: string | null
  notes: string | null
}

export async function saveWorker(db: TenantDb, tenantId: string, id: string | null, input: WorkerInput) {
  if (!(PAY_TYPES as readonly string[]).includes(input.payType) || input.ratePaise <= 0) throw new OrderError("invalid_form")
  const data = { ...input, name: input.name.trim(), role: input.role?.trim() || null, notes: input.notes?.trim() || null }
  if (id) {
    const r = await db.worker.updateMany({ where: { id }, data })
    if (r.count !== 1) throw new OrderError("not_found")
    return id
  }
  return (await db.worker.create({ data: { ...data, tenantId } })).id
}

/** Stopped working here (from a day), or back again (null). Old days and payments stay. */
export async function setWorkerLeft(db: TenantDb, id: string, leftOn: string | null) {
  const r = await db.worker.updateMany({ where: { id }, data: { leftOn } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/**
 * Marks one day for several workers at once: present, half a day or absent, and where they worked. A null state
 * clears the day (not marked). Only the farm's own workers and places; never a day in the future.
 */
export async function markDays(db: TenantDb, tenantId: string, date: string, entries: { workerId: string; state: string | null; placeId: string | null }[], byStaffId: string) {
  if (date > istDate(new Date())) throw new OrderError("record_future")
  const [workers, places] = await Promise.all([
    db.worker.findMany({ where: { id: { in: entries.map((e) => e.workerId) } }, select: { id: true } }),
    db.farmPlace.findMany({ where: { id: { in: entries.map((e) => e.placeId).filter((x): x is string => !!x) } }, select: { id: true } }),
  ])
  await db.$transaction(async (tx) => {
    for (const e of entries) {
      if (!workers.some((w) => w.id === e.workerId)) continue
      if (e.state === null) {
        await tx.workerDay.deleteMany({ where: { workerId: e.workerId, date } })
        continue
      }
      if (!(DAY_STATES as readonly string[]).includes(e.state)) throw new OrderError("invalid_form")
      const placeId = e.placeId && places.some((p) => p.id === e.placeId) ? e.placeId : null
      await tx.workerDay.upsert({
        where: { workerId_date: { workerId: e.workerId, date } },
        create: { tenantId, workerId: e.workerId, date, state: e.state, placeId, byStaffId },
        update: { state: e.state, placeId, byStaffId },
      })
    }
  })
}

/** Money given to a worker, wage or advance. It is labour spending in Money too, made here in one go. */
export async function payWorker(db: TenantDb, tenantId: string, p: { workerId: string; date: string; kind: string; amountPaise: number; note: string | null; byStaffId: string }) {
  if (!isPayKind(p.kind) || p.amountPaise <= 0) throw new OrderError("invalid_form")
  if (p.date > istDate(new Date())) throw new OrderError("record_future")
  const w = await db.worker.findFirst({ where: { id: p.workerId }, select: { id: true, name: true } })
  if (!w) throw new OrderError("not_found")
  const note = p.note?.trim() || null
  await db.$transaction(async (tx) => {
    const e = await tx.expense.create({ data: { tenantId, date: p.date, kind: "labour", amountPaise: p.amountPaise, note: [w.name, note].filter(Boolean).join(" · ").slice(0, 120), byStaffId: p.byStaffId } })
    await tx.workerPayment.create({ data: { tenantId, workerId: w.id, date: p.date, kind: p.kind, amountPaise: p.amountPaise, note, expenseId: e.id, byStaffId: p.byStaffId } })
  })
}

/** Takes back a payment entered by mistake, with its labour expense. */
export async function removePayment(db: TenantDb, id: string) {
  const p = await db.workerPayment.findFirst({ where: { id } })
  if (!p) throw new OrderError("not_found")
  await db.$transaction(async (tx) => {
    await tx.workerPayment.deleteMany({ where: { id } })
    if (p.expenseId) await tx.expense.deleteMany({ where: { id: p.expenseId } })
  })
}

/** Every worker with what they've earned, been given and are owed, and how they're marked on a day. */
export async function workersOn(db: TenantDb, date: string) {
  const [workers, days, paid, onDay] = await Promise.all([
    db.worker.findMany({ orderBy: [{ leftOn: "asc" }, { name: "asc" }] }),
    db.workerDay.findMany({ select: { workerId: true, state: true, date: true, placeId: true } }),
    db.workerPayment.groupBy({ by: ["workerId"], _sum: { amountPaise: true } }),
    db.workerDay.findMany({ where: { date } }),
  ])
  return workers.map((w) => {
    const mine = days.filter((d) => d.workerId === w.id)
    const e = earned(w, mine)
    const given = paid.find((p) => p.workerId === w.id)?._sum.amountPaise ?? 0
    // Where they last worked, to start today's choice from
    const last = mine.filter((d) => d.date < date && d.state !== "absent").sort((a, b) => b.date.localeCompare(a.date))[0]
    const day = onDay.find((d) => d.workerId === w.id)
    return { ...w, earnedPaise: e.paise, paidPaise: given, owedPaise: owed(e.paise, [{ amountPaise: given }]), state: day?.state ?? null, placeId: day ? day.placeId : (last?.placeId ?? null) }
  })
}

/** One worker's month: their days, the payments, and the totals so far. */
export async function workerMonth(db: TenantDb, id: string, month: string) {
  const w = await db.worker.findFirst({ where: { id } })
  if (!w) return null
  const [days, monthDays, payments, allPaid] = await Promise.all([
    db.workerDay.findMany({ where: { workerId: id }, select: { state: true } }),
    db.workerDay.findMany({ where: { workerId: id, date: { startsWith: month } }, orderBy: { date: "asc" } }),
    db.workerPayment.findMany({ where: { workerId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 50 }),
    db.workerPayment.aggregate({ where: { workerId: id }, _sum: { amountPaise: true } }),
  ])
  const total = earned(w, days)
  const month_ = earned(w, monthDays)
  return { worker: w, monthDays, month: month_, payments, owedPaise: owed(total.paise, [{ amountPaise: allPaid._sum.amountPaise ?? 0 }]) }
}
