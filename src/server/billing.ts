import "server-only"
import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import { tenantDb, type TenantTx } from "@/lib/tenant-db"
import { buildInvoiceSnapshot, financialYear, invoiceNumber, type InvoiceSnapshot } from "@/domain/invoices"
import { ledgerBalance, signedAmount } from "@/domain/ledger"
import { orderCode } from "@/domain/orders"
import { OrderError, transition } from "./orders"
import { featuresOf } from "@/lib/features"
import { prisma } from "@/lib/prisma"

export type DeliveryPayment = "cash" | "upi" | "credit"

/**
 * Marks an order delivered and settles it, in one transaction:
 * issues the invoice (if the farm uses invoices), charges the customer's account,
 * and records the payment when cash or UPI was collected ("credit" leaves it as dues,
 * and is refused if the farm has credit accounts switched off).
 */
export async function deliverOrder(tenantId: string, orderId: string, payment: DeliveryPayment, byStaffId: string, now = new Date()) {
  const db = tenantDb(tenantId)
  const features = featuresOf(await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }))
  if (payment === "credit" && !features.creditAccounts) throw new OrderError("credit_off")
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const order = await transition(tx, tenantId, orderId, "delivered", byStaffId, `paid:${payment}`)
        const invoice = features.invoices ? await issueInvoice(tx, tenantId, order.id, now) : null


        await tx.ledgerEntry.create({
          data: { tenantId, customerId: order.customerId, type: "charge", amountPaise: order.totalPaise, refType: "order", refId: order.id },
        })
        if (payment !== "credit") {
          await addPayment(tx, tenantId, {
            customerId: order.customerId,
            orderId: order.id,
            method: payment === "cash" ? "cash_on_delivery" : "upi_on_delivery",
            amountPaise: order.totalPaise,
            byStaffId,
          })
        }
        return { order, invoice }
      })
    } catch (e) {
      // Two invoices took the same number at once: retry with the next one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
      throw e
    }
  }
  throw new OrderError("busy_try_again")
}

/**
 * Next number in a farm's document series for a financial year ("INV" invoices, "CN" credit notes).
 * The upsert takes a row lock, so concurrent documents get consecutive numbers.
 */
export async function nextSeq(tx: TenantTx, tenantId: string, series: "INV" | "CN", fy: string) {
  const counter = await tx.invoiceCounter.upsert({
    where: { tenantId_series_fy: { tenantId, series, fy } },
    create: { tenantId, series, fy, nextSeq: 2 },
    update: { nextSeq: { increment: 1 } },
  })
  return counter.nextSeq - 1
}

/** Issues the invoice for an order (once; a second call returns the existing one). */
export async function issueInvoice(tx: TenantTx, tenantId: string, orderId: string, now = new Date()) {
  const existing = await tx.invoice.findFirst({ where: { orderId, type: { not: "credit_note" } } })
  if (existing) return existing

  // Sequential, not Promise.all: a transaction is one connection and runs one query at a time.
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const order = await tx.order.findFirstOrThrow({
    where: { id: orderId },
    include: { customer: true, address: true, items: { include: { product: true } } },
  })

  const fy = financialYear(now)
  const seq = await nextSeq(tx, tenantId, "INV", fy)
  const number = invoiceNumber(tenant.invoicePrefix, fy, seq)

  const snapshot = buildInvoiceSnapshot({
    number,
    issuedAt: now,
    orderCode: orderCode(tenant.invoicePrefix, order.number),
    farm: { nameTa: tenant.nameTa, nameEn: tenant.nameEn, phone: tenant.phone, gstin: tenant.gstin, fssaiNo: tenant.fssaiNo, upiId: tenant.upiId },
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      address: order.address ? [order.address.line, order.address.landmark].filter(Boolean).join(", ") : null,
    },
    lines: order.items.map((i) => ({
      nameTa: i.product.nameTa,
      nameEn: i.product.nameEn,
      packTa: i.product.packTa,
      packEn: i.product.packEn,
      hsn: i.product.hsn,
      qty: i.qty,
      unitPricePaise: i.unitPricePaise,
      gstRate: i.gstRate,
    })),
    deliveryFeePaise: order.deliveryFeePaise,
  })

  return tx.invoice.create({
    data: {
      tenantId,
      orderId,
      customerId: order.customerId,
      type: snapshot.type,
      number,
      fy,
      seq,
      totalPaise: snapshot.totalPaise,
      taxPaise: snapshot.taxPaise,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      publicToken: randomBytes(18).toString("base64url"),
      issuedAt: now,
    },
  })
}

interface PaymentInput {
  customerId: string
  orderId?: string
  method: "cash_on_delivery" | "upi_on_delivery" | "upi_prepaid"
  amountPaise: number
  byStaffId: string
  reference?: string
  note?: string
}

async function addPayment(tx: TenantTx, tenantId: string, p: PaymentInput) {
  const payment = await tx.payment.create({
    data: {
      tenantId,
      customerId: p.customerId,
      orderId: p.orderId ?? null,
      method: p.method,
      amountPaise: p.amountPaise,
      collectedById: p.byStaffId,
      reference: p.reference ?? null,
      note: p.note ?? null,
    },
  })
  await tx.ledgerEntry.create({
    data: { tenantId, customerId: p.customerId, type: "payment", amountPaise: p.amountPaise, refType: "payment", refId: payment.id, note: p.note ?? null },
  })
  return payment
}

/** A payment received later, e.g. a customer clearing their khata. */
export async function recordPayment(tenantId: string, p: PaymentInput) {
  if (!Number.isInteger(p.amountPaise) || p.amountPaise <= 0) throw new OrderError("bad_amount")
  const db = tenantDb(tenantId)
  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: p.customerId } })
    if (!customer) throw new OrderError("customer_not_found")
    return addPayment(tx, tenantId, p)
  })
}

/** Current khata balance of one customer (positive = owes the farm). */
export async function customerBalance(tenantId: string, customerId: string) {
  const entries = await tenantDb(tenantId).ledgerEntry.findMany({ where: { customerId }, select: { type: true, amountPaise: true } })
  return ledgerBalance(entries)
}

/** Balances of all customers who have any ledger entries, keyed by customer id. */
export async function allBalances(tenantId: string) {
  const rows = await tenantDb(tenantId).ledgerEntry.groupBy({ by: ["customerId", "type"], _sum: { amountPaise: true } })
  const out = new Map<string, number>()
  for (const r of rows) {
    const sum = r._sum.amountPaise ?? 0
    out.set(r.customerId, (out.get(r.customerId) ?? 0) + signedAmount(r.type, sum))
  }
  return out
}

export const readSnapshot = (json: Prisma.JsonValue) => json as unknown as InvoiceSnapshot
