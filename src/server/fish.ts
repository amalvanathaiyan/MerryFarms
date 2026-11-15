import "server-only"
import type { TenantDb } from "@/lib/tenant-db"
import { istDate } from "@/domain/ist"
import { cycleMoney, harvestedCount, latestAverage, pondReminders, pondStock, pondWeight, speciesMix, WATER_CHECKS, waterReadingOk, waterWarnings, type WaterCheck } from "@/domain/fish"
import { inputStock, worth } from "@/domain/inputs"
import { labourByPlace } from "@/domain/workers"
import { OrderError } from "./orders"

/**
 * Fishery for one farm, through its tenant-scoped client. A cycle is one crop of fish in one pond. Feed comes out of
 * the farm store as a use on the pond, and fingerlings bought are "seeds" spending on the pond, so the pond's page
 * and Money show them like any other cost. Rules are in src/domain/fish.ts.
 */

export interface StockingForm {
  date: string
  species: string
  count: number
  sizeGrams: number | null
  costPaise: number
  supplier: string | null
}

const cleanSpecies = (s: string) => s.trim().slice(0, 40)

function checkStocking(s: StockingForm, today: string) {
  if (!cleanSpecies(s.species) || !Number.isInteger(s.count) || s.count <= 0 || s.costPaise < 0 || (s.sizeGrams != null && !(s.sizeGrams > 0))) throw new OrderError("invalid_form")
  if (s.date > today) throw new OrderError("record_future")
}

async function addStockingRow(db: TenantDb, tenantId: string, cycle: { id: string; number: number; placeId: string }, s: StockingForm, byStaffId: string) {
  const species = cleanSpecies(s.species)
  const expense =
    s.costPaise > 0
      ? await db.expense.create({
          data: { tenantId, date: s.date, kind: "seeds", amountPaise: s.costPaise, placeId: cycle.placeId, quantity: s.count, note: `${species} × ${s.count}${s.supplier ? ` · ${s.supplier.trim()}` : ""}`.slice(0, 120), byStaffId },
        })
      : null
  return db.fishStocking.create({
    data: { tenantId, cycleId: cycle.id, date: s.date, species, count: s.count, sizeGrams: s.sizeGrams, costPaise: s.costPaise, supplier: s.supplier?.trim() || null, expenseId: expense?.id ?? null, byStaffId },
  })
}

/** A new cycle in a pond that has none running, with its first stocking. */
export async function startCycle(db: TenantDb, tenantId: string, p: { placeId: string; note: string | null; stocking: StockingForm }, byStaffId: string) {
  const today = istDate(new Date())
  checkStocking(p.stocking, today)
  const pond = await db.farmPlace.findFirst({ where: { id: p.placeId, kind: "pond" }, select: { id: true } })
  if (!pond) throw new OrderError("not_found")
  if (await db.fishCycle.findFirst({ where: { placeId: p.placeId, closedDate: null }, select: { id: true } })) throw new OrderError("pond_busy")
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await db.fishCycle.findFirst({ orderBy: { number: "desc" }, select: { number: true } })
    try {
      const cycle = await db.fishCycle.create({ data: { tenantId, number: (last?.number ?? 0) + 1, placeId: p.placeId, startDate: p.stocking.date, note: p.note?.trim() || null, byStaffId } })
      await addStockingRow(db, tenantId, cycle, p.stocking, byStaffId)
      return cycle.id
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e
    }
  }
  throw new OrderError("busy")
}

async function openCycle(db: TenantDb, id: string) {
  const c = await db.fishCycle.findFirst({ where: { id } })
  if (!c) throw new OrderError("not_found")
  if (c.closedDate) throw new OrderError("cycle_closed")
  return c
}

/** More fish put in later (a second kind, or topping up). */
export async function addStocking(db: TenantDb, tenantId: string, cycleId: string, s: StockingForm, byStaffId: string) {
  checkStocking(s, istDate(new Date()))
  const c = await openCycle(db, cycleId)
  if (s.date < c.startDate) throw new OrderError("before_start")
  await addStockingRow(db, tenantId, c, s, byStaffId)
}

/** A stocking entered by mistake, with its spending. The first stocking can't go (remove the cycle instead). */
export async function removeStocking(db: TenantDb, id: string) {
  const s = await db.fishStocking.findFirst({ where: { id } })
  if (!s) throw new OrderError("not_found")
  await openCycle(db, s.cycleId)
  if ((await db.fishStocking.count({ where: { cycleId: s.cycleId } })) <= 1) throw new OrderError("last_stocking")
  await db.fishStocking.deleteMany({ where: { id } })
  if (s.expenseId) await db.expense.deleteMany({ where: { id: s.expenseId } })
}

export interface FishDayForm {
  date: string
  feedKg: number | null
  /** The store item the feed came out of (fish feed, in kg); null: not taken from the store. */
  feedInputId: string | null
  dead: number
  ph: number | null
  oxygen: number | null
  tempC: number | null
  ammonia: number | null
  note: string | null
}

/** Feed items fish can be given from the store: feed, counted in kg, not the hens' own feed. */
export function fishFeedItems(db: TenantDb) {
  return db.farmInput.findMany({ where: { kind: "feed", unit: "kg", batchFeed: false, retiredAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
}

/**
 * The pond's day: saved again over the same day. Feed from the store becomes (or changes, or stops being) a use of
 * that item on the pond. Fish found dead can't be more than are left.
 */
export async function saveFishDay(db: TenantDb, tenantId: string, cycleId: string, f: FishDayForm, byStaffId: string) {
  const today = istDate(new Date())
  if (f.date > today) throw new OrderError("record_future")
  if (!Number.isInteger(f.dead) || f.dead < 0 || (f.feedKg != null && !(f.feedKg >= 0))) throw new OrderError("invalid_form")
  for (const k of WATER_CHECKS) if (f[k] != null && !waterReadingOk(k, f[k]!)) throw new OrderError("invalid_form")
  const c = await openCycle(db, cycleId)
  if (f.date < c.startDate) throw new OrderError("before_start")
  const [stockings, days, existing, harvests, samples] = await Promise.all([
    db.fishStocking.findMany({ where: { cycleId }, select: { species: true, count: true, sizeGrams: true } }),
    db.fishDay.findMany({ where: { cycleId, NOT: { date: f.date } }, select: { dead: true } }),
    db.fishDay.findFirst({ where: { cycleId, date: f.date } }),
    db.fishHarvest.findMany({ where: { cycleId }, select: { kg: true, count: true } }),
    db.fishSample.findMany({ where: { cycleId }, select: { date: true, species: true, count: true, totalGrams: true } }),
  ])
  if (f.dead > pondStock(stockings, days, harvestedCount(harvests, latestAverage(samples))).left) throw new OrderError("too_many_dead")
  const feedKg = f.feedKg && f.feedKg > 0 ? Math.round(f.feedKg * 100) / 100 : null
  const feedInputId = feedKg ? f.feedInputId : null
  if (feedInputId && !(await db.farmInput.findFirst({ where: { id: feedInputId, kind: "feed", unit: "kg", batchFeed: false }, select: { id: true } }))) throw new OrderError("not_found")

  // The store use follows the day's feed.
  let feedUseId = existing?.feedUseId ?? null
  if (feedUseId && (!feedInputId || existing?.feedInputId !== feedInputId)) {
    await db.inputUse.deleteMany({ where: { id: feedUseId } })
    feedUseId = null
  }
  if (feedInputId && feedKg) {
    const note = `Cycle ${c.number}`
    if (feedUseId) await db.inputUse.updateMany({ where: { id: feedUseId }, data: { quantity: feedKg, date: f.date } })
    else feedUseId = (await db.inputUse.create({ data: { tenantId, inputId: feedInputId, date: f.date, kind: "used", quantity: feedKg, placeId: c.placeId, note, byStaffId } })).id
  }
  const data = {
    feedKg,
    feedInputId,
    feedUseId,
    dead: f.dead,
    ph: f.ph,
    oxygen: f.oxygen,
    tempC: f.tempC,
    ammonia: f.ammonia,
    note: f.note?.trim() || null,
    byStaffId,
  }
  if (existing) await db.fishDay.updateMany({ where: { id: existing.id }, data })
  else await db.fishDay.create({ data: { ...data, tenantId, cycleId, date: f.date } })
}

/** A net sample: so many fish weighed together. */
export async function addSample(db: TenantDb, tenantId: string, cycleId: string, s: { date: string; species: string | null; count: number; totalGrams: number }, byStaffId: string) {
  if (!Number.isInteger(s.count) || s.count <= 0 || !(s.totalGrams > 0) || s.totalGrams / s.count > 50_000) throw new OrderError("invalid_form")
  if (s.date > istDate(new Date())) throw new OrderError("record_future")
  const c = await openCycle(db, cycleId)
  if (s.date < c.startDate) throw new OrderError("before_start")
  await db.fishSample.create({ data: { tenantId, cycleId, date: s.date, species: s.species ? cleanSpecies(s.species) : null, count: s.count, totalGrams: s.totalGrams, byStaffId } })
}

export async function removeSample(db: TenantDb, id: string) {
  const r = await db.fishSample.deleteMany({ where: { id } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/** The pond is empty (harvested out, or given up); its pond is free for a new cycle. Can be opened again. */
export async function closeCycle(db: TenantDb, id: string, date: string) {
  const c = await openCycle(db, id)
  if (date > istDate(new Date())) throw new OrderError("record_future")
  if (date < c.startDate) throw new OrderError("before_start")
  await db.fishCycle.updateMany({ where: { id }, data: { closedDate: date } })
}

export async function reopenCycle(db: TenantDb, id: string) {
  const c = await db.fishCycle.findFirst({ where: { id } })
  if (!c?.closedDate) throw new OrderError("not_found")
  if (await db.fishCycle.findFirst({ where: { placeId: c.placeId, closedDate: null }, select: { id: true } })) throw new OrderError("pond_busy")
  await db.fishCycle.updateMany({ where: { id }, data: { closedDate: null } })
}

/** A cycle with everything in it (stockings, days, samples) put in order. */
async function load(db: TenantDb, where: { id?: string; closedDate?: null }) {
  return db.fishCycle.findMany({
    where,
    orderBy: { number: "desc" },
    include: {
      stockings: { orderBy: { date: "asc" } },
      days: { orderBy: { date: "desc" } },
      samples: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      harvests: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  })
}

type Loaded = Awaited<ReturnType<typeof load>>[number]

function summary(c: Loaded, today: string) {
  const average = latestAverage(c.samples)
  const stock = pondStock(c.stockings, c.days, harvestedCount(c.harvests, average))
  const feedKg = Math.round(c.days.reduce((a, d) => a + (d.feedKg ?? 0), 0) * 10) / 10
  const harvestKg = Math.round(c.harvests.reduce((a, h) => a + h.kg, 0) * 10) / 10
  const lastWater = c.days.find((d) => WATER_CHECKS.some((k) => d[k] != null)) ?? null
  return {
    ...stock,
    mix: speciesMix(c.stockings),
    feedKg,
    average,
    weight: pondWeight(stock.left, average, c.stockings, feedKg),
    harvestKg,
    lastSampleDate: c.samples[0]?.date ?? null,
    enteredToday: c.days.some((d) => d.date === today),
    lastWater: lastWater ? { date: lastWater.date, warnings: waterWarnings(lastWater) } : null,
  }
}

/** The farm's cycles with their ponds' names: running ones (with numbers) and finished ones (a short list). */
export async function fishBook(db: TenantDb, today: string) {
  const [open, closed, ponds] = await Promise.all([
    load(db, { closedDate: null }),
    db.fishCycle.findMany({ where: { NOT: { closedDate: null } }, orderBy: { closedDate: "desc" }, take: 20, select: { id: true, number: true, placeId: true, startDate: true, closedDate: true } }),
    db.farmPlace.findMany({ where: { kind: "pond" }, select: { id: true, name: true, retiredAt: true }, orderBy: { name: "asc" } }),
  ])
  const pondName = new Map(ponds.map((p) => [p.id, p.name]))
  const busy = new Set(open.map((c) => c.placeId))
  return {
    open: open.map((c) => ({ id: c.id, number: c.number, pond: pondName.get(c.placeId) ?? "", startDate: c.startDate, ...summary(c, today) })),
    closed: closed.map((c) => ({ ...c, pond: pondName.get(c.placeId) ?? "" })),
    freePonds: ponds.filter((p) => !p.retiredAt && !busy.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
    hasPonds: ponds.some((p) => !p.retiredAt),
  }
}

export async function cycleDetail(db: TenantDb, id: string, today: string) {
  const [c] = await load(db, { id })
  if (!c) return null
  const pond = await db.farmPlace.findFirst({ where: { id: c.placeId }, select: { id: true, name: true } })
  return { cycle: c, pond, ...summary(c, today) }
}

export type WaterReadings = Partial<Record<WaterCheck, number | null>>

export interface HarvestForm {
  date: string
  species: string | null
  kg: number
  count: number | null
  soldPaise: number
  buyer: string | null
}

/** Fish taken out, sold or kept. "That was all of them" closes the cycle on the same day, freeing the pond. */
export async function addHarvest(db: TenantDb, tenantId: string, cycleId: string, h: HarvestForm, byStaffId: string, lastOne: boolean) {
  if (!(h.kg > 0) || h.soldPaise < 0 || (h.count != null && (!Number.isInteger(h.count) || h.count <= 0))) throw new OrderError("invalid_form")
  if (h.date > istDate(new Date())) throw new OrderError("record_future")
  const c = await openCycle(db, cycleId)
  if (h.date < c.startDate) throw new OrderError("before_start")
  if (h.count != null) {
    const [loaded] = await load(db, { id: cycleId })
    if (h.count > summary(loaded, h.date).left) throw new OrderError("too_many_fish")
  }
  await db.fishHarvest.create({
    data: { tenantId, cycleId, date: h.date, species: h.species ? cleanSpecies(h.species) : null, kg: h.kg, count: h.count, soldPaise: h.soldPaise, buyer: h.buyer?.trim() || null, byStaffId },
  })
  if (lastOne) await db.fishCycle.updateMany({ where: { id: cycleId }, data: { closedDate: h.date } })
}

export async function removeHarvest(db: TenantDb, id: string) {
  const h = await db.fishHarvest.findFirst({ where: { id } })
  if (!h) throw new OrderError("not_found")
  await openCycle(db, h.cycleId)
  await db.fishHarvest.deleteMany({ where: { id } })
}

/**
 * A cycle's money: harvests sold, against what was spent on its pond while it ran (spending booked to the pond, the
 * store's items used there at their average price, and workers' days there).
 */
export async function cycleMoneyFor(db: TenantDb, c: { id: string; placeId: string; startDate: string; closedDate: string | null }, harvests: { soldPaise: number; kg: number }[], today: string) {
  const range = { gte: c.startDate, lte: c.closedDate ?? today }
  const [spent, allUses, days, othersFeed] = await Promise.all([
    db.expense.aggregate({ where: { placeId: c.placeId, date: range }, _sum: { amountPaise: true } }),
    db.inputUse.findMany({ where: { kind: "used", placeId: c.placeId, date: range }, select: { id: true, inputId: true, quantity: true } }),
    db.workerDay.findMany({ where: { placeId: c.placeId, date: range }, select: { workerId: true, state: true, placeId: true } }),
    // The day one cycle ends and the next starts: feed entered for the other cycle stays with it.
    db.fishDay.findMany({ where: { cycleId: { not: c.id }, cycle: { placeId: c.placeId }, date: range, feedUseId: { not: null } }, select: { feedUseId: true } }),
  ])
  const notOurs = new Set(othersFeed.map((d) => d.feedUseId))
  const uses = allUses.filter((u) => !notOurs.has(u.id))
  const ids = [...new Set(uses.map((u) => u.inputId))]
  const [buys, workers] = await Promise.all([
    ids.length ? db.expense.findMany({ where: { inputId: { in: ids } }, select: { inputId: true, quantity: true, amountPaise: true } }) : Promise.resolve([]),
    days.length ? db.worker.findMany({ where: { id: { in: [...new Set(days.map((d) => d.workerId))] } }, select: { id: true, payType: true, ratePaise: true } }) : Promise.resolve([]),
  ])
  const price = new Map(ids.map((id) => [id, inputStock(buys.filter((b) => b.inputId === id), []).pricePaise]))
  const storePaise = uses.reduce((a, u) => a + (worth(u.quantity, price.get(u.inputId) ?? null) ?? 0), 0)
  return cycleMoney({
    soldPaise: harvests.reduce((a, h) => a + h.soldPaise, 0),
    spentPaise: spent._sum.amountPaise ?? 0,
    storePaise,
    labourPaise: labourByPlace(workers, days).get(c.placeId) ?? 0,
    harvestKg: harvests.reduce((a, h) => a + h.kg, 0),
  })
}

/** Today's pond reminders: water out of range lately, and size checks due. */
export async function fishRemindersFor(db: TenantDb, today: string) {
  const book = await fishBook(db, today)
  return pondReminders(book.open, today)
}
