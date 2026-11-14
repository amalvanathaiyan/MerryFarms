import "server-only"
import type { TenantDb } from "@/lib/tenant-db"
import { istDate } from "@/domain/ist"
import { countChange, expenseKindFor, inputStock, isInputKind, isInputUnit, worth } from "@/domain/inputs"
import { OrderError } from "./orders"

/**
 * Farm Core's store for one farm, through its tenant-scoped client. Rules are in src/domain/inputs.ts. Buying is
 * spending in Money (an expense with the item and quantity), so it shows in profit without being entered twice;
 * deleting that spending in Money takes it out of the store too.
 */

export interface InputForm {
  name: string
  kind: string
  unit: string
  lowAt: number | null
  batchFeed: boolean
}

/** Adds or changes an item. The hens' feed is one item per farm, in kg: marking one takes the mark off any other. */
export async function saveInput(db: TenantDb, tenantId: string, id: string | null, f: InputForm) {
  if (!isInputKind(f.kind) || !isInputUnit(f.unit) || (f.lowAt != null && f.lowAt < 0)) throw new OrderError("invalid_form")
  if (f.batchFeed && (f.kind !== "feed" || f.unit !== "kg")) throw new OrderError("invalid_form")
  const data = { name: f.name.trim(), kind: f.kind, unit: f.unit, lowAt: f.lowAt, batchFeed: f.batchFeed }
  return db.$transaction(async (tx) => {
    if (f.batchFeed) await tx.farmInput.updateMany({ where: { batchFeed: true, ...(id ? { id: { not: id } } : {}) }, data: { batchFeed: false } })
    if (id) {
      const r = await tx.farmInput.updateMany({ where: { id }, data })
      if (r.count !== 1) throw new OrderError("not_found")
      return id
    }
    return (await tx.farmInput.create({ data: { ...data, tenantId } })).id
  })
}

/** No longer kept (or kept again). Its purchases and uses stay. */
export async function setInputRetired(db: TenantDb, id: string, retired: boolean) {
  const r = await db.farmInput.updateMany({ where: { id }, data: { retiredAt: retired ? new Date() : null } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/** The farm's hen-feed item, made the first time feed is bought by the kg (named in the farm's language). */
export async function henFeedItem(db: TenantDb, tenantId: string, name: string) {
  const found = await db.farmInput.findFirst({ where: { batchFeed: true }, select: { id: true } })
  if (found) return found.id
  return (await db.farmInput.create({ data: { tenantId, name, kind: "feed", unit: "kg", batchFeed: true } })).id
}

/** The hens' feed bought, latest first: the hen-feed item's purchases, and feed bought before the store. */
export async function henFeedBuys(db: TenantDb, take: number) {
  const henFeed = await db.farmInput.findFirst({ where: { batchFeed: true }, select: { id: true } })
  return db.expense.findMany({
    where: { OR: [...(henFeed ? [{ inputId: henFeed.id }] : []), { kind: "feed", inputId: null }] },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
  })
}

/** Bought into the store: spending in Money for the item's kind, with the item and how much. */
export async function buyInput(db: TenantDb, tenantId: string, p: { inputId: string; date: string; quantity: number; amountPaise: number; note: string | null; byStaffId: string }) {
  if (!(p.quantity > 0) || !(p.amountPaise > 0)) throw new OrderError("invalid_form")
  if (p.date > istDate(new Date())) throw new OrderError("record_future")
  const item = await db.farmInput.findFirst({ where: { id: p.inputId } })
  if (!item) throw new OrderError("not_found")
  const note = [item.name, p.note?.trim()].filter(Boolean).join(" · ").slice(0, 120)
  await db.expense.create({
    data: { tenantId, date: p.date, kind: expenseKindFor(item.kind), amountPaise: p.amountPaise, inputId: item.id, quantity: p.quantity, quantityKg: item.batchFeed ? p.quantity : null, note, byStaffId: p.byStaffId },
  })
}

/** Taken out of the store, maybe on a place (fertiliser on a plot). */
export async function takeOutInput(db: TenantDb, tenantId: string, p: { inputId: string; date: string; quantity: number; placeId: string | null; note: string | null; byStaffId: string }) {
  if (!(p.quantity > 0)) throw new OrderError("invalid_form")
  if (p.date > istDate(new Date())) throw new OrderError("record_future")
  const [item, place] = await Promise.all([
    db.farmInput.findFirst({ where: { id: p.inputId }, select: { id: true } }),
    p.placeId ? db.farmPlace.findFirst({ where: { id: p.placeId }, select: { id: true } }) : null,
  ])
  if (!item || (p.placeId && !place)) throw new OrderError("not_found")
  await db.inputUse.create({ data: { tenantId, inputId: item.id, date: p.date, kind: "used", quantity: p.quantity, placeId: p.placeId, note: p.note?.trim() || null, byStaffId: p.byStaffId } })
}

/** The store counted: what's really there. Saves the change from what the book said (nothing when it agrees). */
export async function countInput(db: TenantDb, tenantId: string, p: { inputId: string; counted: number; byStaffId: string }) {
  if (!(p.counted >= 0)) throw new OrderError("invalid_form")
  const today = istDate(new Date())
  const s = await stockOf(db, p.inputId, today)
  if (!s) throw new OrderError("not_found")
  const change = countChange(s.stock.left, p.counted)
  if (change === 0) return
  await db.inputUse.create({ data: { tenantId, inputId: p.inputId, date: today, kind: "count", quantity: change, byStaffId: p.byStaffId } })
}

/** Takes back a use or a count entered by mistake. */
export async function removeUse(db: TenantDb, id: string) {
  const r = await db.inputUse.deleteMany({ where: { id } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/** Kg given to batches in their daily entries, up to a day. */
async function batchFedKg(db: TenantDb, asOf: string) {
  const r = await db.batchDay.aggregate({ where: { date: { lte: asOf } }, _sum: { feedKg: true } })
  return r._sum.feedKg ?? 0
}

/** One item's stock as it stood at the end of a day. */
async function stockOf(db: TenantDb, id: string, asOf: string) {
  const item = await db.farmInput.findFirst({ where: { id } })
  if (!item) return null
  const [buys, uses, fed] = await Promise.all([
    db.expense.findMany({ where: { inputId: id, date: { lte: asOf } }, select: { quantity: true, amountPaise: true } }),
    db.inputUse.findMany({ where: { inputId: id, date: { lte: asOf } }, select: { kind: true, quantity: true } }),
    item.batchFeed ? batchFedKg(db, asOf) : 0,
  ])
  return { item, stock: inputStock(buys, uses, fed) }
}

/** Every item with what's left (items no longer kept last). */
export async function storeList(db: TenantDb, asOf: string) {
  const [items, buys, uses] = await Promise.all([
    db.farmInput.findMany({ orderBy: [{ retiredAt: { sort: "asc", nulls: "first" } }, { name: "asc" }] }),
    db.expense.findMany({ where: { inputId: { not: null }, date: { lte: asOf } }, select: { inputId: true, quantity: true, amountPaise: true } }),
    db.inputUse.findMany({ where: { date: { lte: asOf } }, select: { inputId: true, kind: true, quantity: true } }),
  ])
  const fed = items.some((i) => i.batchFeed) ? await batchFedKg(db, asOf) : 0
  return items.map((item) => ({
    item,
    stock: inputStock(
      buys.filter((b) => b.inputId === item.id),
      uses.filter((u) => u.inputId === item.id),
      item.batchFeed ? fed : 0
    ),
  }))
}

/** One item: its stock, and what came in and went out (latest first). */
export async function inputDetail(db: TenantDb, id: string, today: string) {
  const s = await stockOf(db, id, today)
  if (!s) return null
  const [buys, uses] = await Promise.all([
    db.expense.findMany({ where: { inputId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30, select: { id: true, date: true, quantity: true, amountPaise: true, note: true } }),
    db.inputUse.findMany({ where: { inputId: id }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 30 }),
  ])
  return { ...s, buys, uses }
}

/**
 * What the store's items used on each place were worth since a day (at each item's average price), for the Places
 * page beside the spending and labour on them.
 */
export async function inputsByPlace(db: TenantDb, since: string) {
  const uses = await db.inputUse.findMany({ where: { kind: "used", placeId: { not: null }, date: { gte: since } }, select: { inputId: true, placeId: true, quantity: true } })
  if (uses.length === 0) return new Map<string, number>()
  const ids = [...new Set(uses.map((u) => u.inputId))]
  const buys = await db.expense.findMany({ where: { inputId: { in: ids } }, select: { inputId: true, quantity: true, amountPaise: true } })
  const price = new Map(ids.map((id) => [id, inputStock(buys.filter((b) => b.inputId === id), []).pricePaise]))
  const out = new Map<string, number>()
  for (const u of uses) {
    const v = worth(u.quantity, price.get(u.inputId) ?? null)
    if (v) out.set(u.placeId!, (out.get(u.placeId!) ?? 0) + v)
  }
  return out
}
