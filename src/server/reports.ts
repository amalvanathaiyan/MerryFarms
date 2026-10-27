import "server-only"
import type { Prisma } from "@prisma/client"
import { tenantDb } from "@/lib/tenant-db"
import { addDays, istDate, istInstant } from "@/domain/ist"
import { callStats, dailySeries, productTotals, salesSummary, type DeliveredOrder, type ReturnRow } from "@/domain/reports"
import { allBalances, readSnapshot } from "./billing"

const asLines = (json: Prisma.JsonValue) => json as unknown as { productId: string; qty: number; unitPricePaise: number }[]

/** Instants covering IST dates from..to inclusive. */
const span = (from: string, to: string) => ({ gte: istInstant(from, "00:00"), lt: istInstant(addDays(to, 1), "00:00") })

/** Everything the reports page shows for one farm and period. */
export async function loadReport(tenantId: string, from: string, to: string) {
  const db = tenantDb(tenantId)
  const at = span(from, to)
  const [orders, returns, payments, calls, products] = await Promise.all([
    db.order.findMany({ where: { status: "delivered", deliveredAt: at }, include: { items: true } }),
    db.orderReturn.findMany({ where: { at } }),
    db.payment.findMany({ where: { at, status: { in: ["received", "refunded"] } } }),
    db.confirmationCall.findMany({ where: { at }, select: { orderId: true, outcome: true, at: true } }),
    db.product.findMany(),
  ])

  const delivered: DeliveredOrder[] = orders.map((o) => ({
    date: istDate(o.deliveredAt!),
    channel: o.channel,
    totalPaise: o.totalPaise,
    deliveryFeePaise: o.deliveryFeePaise,
    items: o.items.map((i) => ({ productId: i.productId, qty: i.qty, unitPricePaise: i.unitPricePaise })),
  }))
  const returned: ReturnRow[] = returns.map((r) => ({ date: istDate(r.at), amountPaise: r.amountPaise, items: asLines(r.items) }))

  return {
    summary: salesSummary(delivered, returned, payments),
    daily: dailySeries(from, to, delivered, returned),
    products: productTotals(delivered, returned).map((p) => ({ ...p, product: products.find((x) => x.id === p.productId) ?? null })),
    calls: callStats(calls),
  }
}

/** Customers who owe the farm, most first. */
export async function duesList(tenantId: string) {
  const balances = await allBalances(tenantId)
  const owing = [...balances.entries()].filter(([, b]) => b > 0)
  if (owing.length === 0) return []
  const customers = await tenantDb(tenantId).customer.findMany({ where: { id: { in: owing.map(([id]) => id) } } })
  return owing
    .map(([id, balancePaise]) => ({ customer: customers.find((c) => c.id === id)!, balancePaise }))
    .filter((r) => r.customer)
    .sort((a, b) => b.balancePaise - a.balancePaise)
}

/** Invoices and credit notes issued in the period, for the sales register. */
export async function documentsIn(tenantId: string, from: string, to: string) {
  const docs = await tenantDb(tenantId).invoice.findMany({ where: { issuedAt: span(from, to) }, orderBy: [{ issuedAt: "asc" }] })
  return docs.map((d) => ({ ...d, s: readSnapshot(d.snapshot) }))
}

export async function paymentsIn(tenantId: string, from: string, to: string) {
  return tenantDb(tenantId).payment.findMany({ where: { at: span(from, to) }, include: { customer: true }, orderBy: { at: "asc" } })
}
