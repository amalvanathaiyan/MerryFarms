import "server-only"
import type { tenantDb } from "@/lib/tenant-db"
import { unitsFromEggs } from "@/domain/eggs"

/**
 * Every change to a product's stock goes through here.
 *
 * Most products keep their own count (stockQty). Egg products (eggsPerUnit set: a tray of 30, a pack of 12) share
 * the farm's egg store instead: selling a tray takes 30 eggs out of it, and each egg product's stockQty is always
 * the number of whole units that can be packed from the store. The rest of the app keeps reading stockQty.
 *
 * Changes to the store lock the farm's row first, so two orders at the same moment can't both take the last eggs.
 */
type Db = ReturnType<typeof tenantDb>
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0]

async function lockStore(tx: Tx, tenantId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ eggStore: number }[]>`SELECT "eggStore" FROM "tenants" WHERE "id" = ${tenantId} FOR UPDATE`
  return rows[0]?.eggStore ?? 0
}

/** Sets every egg product's stock from the store: whole trays or packs that can be packed. */
export async function syncEggStock(tx: Tx, tenantId: string, store?: number) {
  const eggs = store ?? (await lockStore(tx, tenantId))
  const products = await tx.product.findMany({ where: { tenantId, eggsPerUnit: { not: null } }, select: { id: true, eggsPerUnit: true, stockQty: true } })
  for (const p of products) {
    const qty = unitsFromEggs(eggs, p.eggsPerUnit!)
    if (qty !== p.stockQty) await tx.product.updateMany({ where: { id: p.id }, data: { stockQty: qty } })
  }
}

/** Adds (or, when negative, removes) loose eggs: a batch's good eggs, a correction. Never below zero. */
export async function addEggs(tx: Tx, tenantId: string, eggs: number) {
  if (!eggs) return
  const store = await lockStore(tx, tenantId)
  const next = Math.max(0, store + eggs)
  await tx.tenant.updateMany({ where: { id: tenantId }, data: { eggStore: next } })
  await syncEggStock(tx, tenantId, next)
}

/** Sets the eggs in store to a counted number (the owner counting the store). */
export async function setEggStore(tx: Tx, tenantId: string, eggs: number) {
  await lockStore(tx, tenantId)
  const next = Math.max(0, Math.round(eggs))
  await tx.tenant.updateMany({ where: { id: tenantId }, data: { eggStore: next } })
  await syncEggStock(tx, tenantId, next)
}

const eggsPerUnitOf = async (tx: Tx, productId: string) => (await tx.product.findFirst({ where: { id: productId }, select: { eggsPerUnit: true } }))?.eggsPerUnit ?? null

/** Takes qty units for an order. Returns false (and changes nothing) when there isn't enough. */
export async function takeStock(tx: Tx, tenantId: string, productId: string, qty: number): Promise<boolean> {
  if (qty <= 0) return true
  const per = await eggsPerUnitOf(tx, productId)
  if (!per) {
    const r = await tx.product.updateMany({ where: { id: productId, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } })
    return r.count === 1
  }
  const store = await lockStore(tx, tenantId)
  if (store < qty * per) return false
  const next = store - qty * per
  await tx.tenant.updateMany({ where: { id: tenantId }, data: { eggStore: next } })
  await syncEggStock(tx, tenantId, next)
  return true
}

/** Puts qty units back (a cancelled order, a return) or adds made stock. */
export async function putStock(tx: Tx, tenantId: string, productId: string, qty: number) {
  if (qty <= 0) return
  const per = await eggsPerUnitOf(tx, productId)
  if (!per) {
    await tx.product.updateMany({ where: { id: productId }, data: { stockQty: { increment: qty } } })
    return
  }
  await addEggs(tx, tenantId, qty * per)
}

/** Takes up to qty units, never below zero (a correction to what was made). */
export async function removeStockUpTo(tx: Tx, tenantId: string, productId: string, qty: number) {
  if (qty <= 0) return
  const per = await eggsPerUnitOf(tx, productId)
  if (!per) {
    const p = await tx.product.findFirst({ where: { id: productId }, select: { stockQty: true } })
    await tx.product.updateMany({ where: { id: productId }, data: { stockQty: { decrement: Math.min(p?.stockQty ?? 0, qty) } } })
    return
  }
  await addEggs(tx, tenantId, -qty * per)
}
