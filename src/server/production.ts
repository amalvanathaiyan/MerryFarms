import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { checkProduction, productionStockDelta } from "@/domain/records"
import { OrderError } from "./orders"

/**
 * Saves a day's production for several products at once. With `toStock`, the good
 * quantity goes into stock; saving the day again moves stock only by the difference.
 * A product left at 0 made and 0 spoiled removes that day's entry.
 */
export async function saveProduction(
  tenantId: string,
  byStaffId: string | null,
  date: string,
  entries: { productId: string; made: number; wasted: number }[],
  toStock: boolean
) {
  for (const e of entries) {
    const problem = checkProduction(e)
    if (problem) throw new OrderError(problem)
  }
  const db = tenantDb(tenantId)
  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: entries.map((e) => e.productId) }, deletedAt: null }, select: { id: true, stockQty: true } })
    if (products.length !== new Set(entries.map((e) => e.productId)).size) throw new OrderError("product_not_found")
    for (const e of entries) {
      const before = await tx.productionEntry.findFirst({ where: { date, productId: e.productId } })
      if (e.made === 0 && e.wasted === 0) {
        if (before) await tx.productionEntry.deleteMany({ where: { id: before.id } })
      } else {
        await tx.productionEntry.upsert({
          where: { tenantId_date_productId: { tenantId, date, productId: e.productId } },
          update: { made: e.made, wasted: e.wasted, byStaffId },
          create: { tenantId, date, productId: e.productId, made: e.made, wasted: e.wasted, byStaffId },
        })
      }
      // Stock is counted in whole units; fractions (e.g. 18.5 litres) round to the nearest.
      const delta = toStock ? Math.round(productionStockDelta(before, e)) : 0
      if (delta > 0) await tx.product.updateMany({ where: { id: e.productId }, data: { stockQty: { increment: delta } } })
      if (delta < 0) {
        const stock = products.find((p) => p.id === e.productId)!.stockQty
        await tx.product.updateMany({ where: { id: e.productId }, data: { stockQty: { decrement: Math.min(stock, -delta) } } })
      }
    }
  })
}
