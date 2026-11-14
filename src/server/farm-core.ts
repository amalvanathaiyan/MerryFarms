import "server-only"
import type { TenantDb } from "@/lib/tenant-db"
import { addDays, istDate } from "@/domain/ist"
import { ASSET_KINDS, AREA_UNITS, isOneOf, LAND_KINDS, PLACE_KINDS, SIZED_KINDS, SOILS, WATER_KINDS } from "@/domain/farm-core"
import { OrderError } from "./orders"

/**
 * Farm Core's places (land, plots, sheds, ponds, wells) and assets (motors, tractors) for one farm, through its
 * tenant-scoped client. Rules are in src/domain/farm-core.ts. Their spending is ordinary expenses with placeId or
 * assetId, so it shows in Money and in profit as the farm's common costs.
 */

export interface PlaceInput {
  kind: string
  name: string
  parentId: string | null
  area: number | null
  areaUnit: string
  surveyNo: string | null
  soil: string | null
  depthFt: number | null
  notes: string | null
}

/** Saves a place, keeping only the details its kind has (a shed has no soil, a well no area). */
export async function savePlace(db: TenantDb, tenantId: string, id: string | null, input: PlaceInput) {
  if (!isOneOf(PLACE_KINDS, input.kind)) throw new OrderError("invalid_form")
  const land = isOneOf(LAND_KINDS, input.kind)
  const sized = isOneOf(SIZED_KINDS, input.kind)
  // A plot may sit inside a block of this farm; nothing else has a parent
  let parentId: string | null = null
  if (input.kind === "plot" && input.parentId) {
    const block = await db.farmPlace.findFirst({ where: { id: input.parentId, kind: "block", retiredAt: null }, select: { id: true } })
    if (!block) throw new OrderError("not_found")
    parentId = block.id
  }
  const data = {
    kind: input.kind,
    name: input.name.trim(),
    parentId,
    area: sized ? input.area : null,
    areaUnit: sized && isOneOf(AREA_UNITS, input.areaUnit) ? input.areaUnit : "acre",
    surveyNo: land ? input.surveyNo?.trim() || null : null,
    soil: land && isOneOf(SOILS, input.soil) ? input.soil : null,
    depthFt: isOneOf(WATER_KINDS, input.kind) ? input.depthFt : null,
    notes: input.notes?.trim() || null,
  }
  if (id) {
    const r = await db.farmPlace.updateMany({ where: { id }, data })
    if (r.count !== 1) throw new OrderError("not_found")
    return id
  }
  const count = await db.farmPlace.count()
  const made = await db.farmPlace.create({ data: { ...data, tenantId, sortOrder: count } })
  return made.id
}

/** No longer used (sold, filled in, merged): hidden from lists and pickers, kept for old spending. Or back in use. */
export async function setPlaceRetired(db: TenantDb, id: string, retired: boolean) {
  const r = await db.farmPlace.updateMany({ where: { id }, data: { retiredAt: retired ? new Date() : null } })
  if (r.count !== 1) throw new OrderError("not_found")
  // A block's plots go with it
  if (retired) await db.farmPlace.updateMany({ where: { parentId: id, retiredAt: null }, data: { retiredAt: new Date() } })
}

export interface AssetInput {
  kind: string
  name: string
  placeId: string | null
  boughtOn: string | null
  costPaise: number | null
  serviceEveryDays: number | null
  lastServiceOn: string | null
  notes: string | null
}

export async function saveAsset(db: TenantDb, tenantId: string, id: string | null, input: AssetInput) {
  if (!isOneOf(ASSET_KINDS, input.kind)) throw new OrderError("invalid_form")
  const placeId = input.placeId && (await db.farmPlace.findFirst({ where: { id: input.placeId }, select: { id: true } })) ? input.placeId : null
  const data = { ...input, name: input.name.trim(), placeId, notes: input.notes?.trim() || null }
  if (id) {
    const r = await db.farmAsset.updateMany({ where: { id }, data })
    if (r.count !== 1) throw new OrderError("not_found")
    return id
  }
  return (await db.farmAsset.create({ data: { ...data, tenantId } })).id
}

export async function setAssetRetired(db: TenantDb, id: string, retired: boolean) {
  const r = await db.farmAsset.updateMany({ where: { id }, data: { retiredAt: retired ? new Date() : null } })
  if (r.count !== 1) throw new OrderError("not_found")
}

/**
 * An asset was serviced or repaired: the date becomes its last service (when it's a service), and what it cost, if
 * anything, is spent on it (an expense with assetId), so it shows in Money and the asset's history.
 */
export async function logAssetWork(db: TenantDb, tenantId: string, id: string, w: { date: string; service: boolean; amountPaise: number | null; note: string | null; byStaffId: string }) {
  const a = await db.farmAsset.findFirst({ where: { id } })
  if (!a) throw new OrderError("not_found")
  if (w.date > istDate(new Date())) throw new OrderError("record_future")
  if (w.service && (!a.lastServiceOn || w.date > a.lastServiceOn)) await db.farmAsset.updateMany({ where: { id }, data: { lastServiceOn: w.date } })
  if (w.amountPaise) {
    await db.expense.create({ data: { tenantId, date: w.date, kind: "repairs", amountPaise: w.amountPaise, assetId: id, placeId: null, note: w.note?.trim() || null, byStaffId: w.byStaffId } })
  }
}

/** What was spent on each place and asset in the last 12 months, and each asset's latest costs. */
export async function farmCoreSpending(db: TenantDb, today = istDate(new Date())) {
  const since = addDays(today, -365)
  const rows = await db.expense.findMany({ where: { date: { gte: since }, OR: [{ placeId: { not: null } }, { assetId: { not: null } }] }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] })
  const byPlace: Record<string, number> = {}
  const byAsset: Record<string, number> = {}
  const latest: Record<string, typeof rows> = {}
  for (const e of rows) {
    if (e.placeId) byPlace[e.placeId] = (byPlace[e.placeId] ?? 0) + e.amountPaise
    if (e.assetId) {
      byAsset[e.assetId] = (byAsset[e.assetId] ?? 0) + e.amountPaise
      if ((latest[e.assetId] ??= []).length < 5) latest[e.assetId].push(e)
    }
  }
  return { byPlace, byAsset, latest }
}
