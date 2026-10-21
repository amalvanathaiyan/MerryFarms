import "server-only"
import { randomBytes } from "node:crypto"
import { Prisma, type RefundMethod, type ReturnReason } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { featuresOf } from "@/lib/features"
import { tenantDb, type TenantTx } from "@/lib/tenant-db"
import { buildInvoiceSnapshot, creditNoteNumber, financialYear } from "@/domain/invoices"
import { orderCode } from "@/domain/orders"
import { planReturn, ReturnError, type DeliveredLine, type ReturnPlan } from "@/domain/returns"
import { nextSeq, readSnapshot } from "./billing"
import { OrderError } from "./orders"

export interface ReturnInput {
  items: { productId: string; qty: number }[]
  reason: ReturnReason
  note?: string
  /** "account" reduces dues (or leaves an advance); cash/upi pays the money back now. */
  refundMethod: RefundMethod
  /** Put returned goods back into stock (only when they're fit to sell again). */
  restock: boolean
  /** Whole order came back (failed or wrong delivery): refund the delivery charge too. */
  refundDeliveryFee: boolean
}

const asLines = (json: Prisma.JsonValue) => json as unknown as { productId: string; qty: number }[]

/**
 * Records goods returned or short delivered after delivery, in one transaction:
 * restocks (if asked and stock is tracked), issues a credit note against the original
 * invoice (if the farm uses invoices), credits the customer's account, and records
 * any refund paid back in cash or UPI.
 */
export async function processReturn(tenantId: string, orderId: string, input: ReturnInput, byStaffId: string, now = new Date()) {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } })
  const features = featuresOf(tenant)
  if (!features.returns) throw new OrderError("returns_off")
  if (input.refundMethod === "account" && !features.creditAccounts) throw new OrderError("credit_off")

  const db = tenantDb(tenantId)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: orderId },
          include: { items: { include: { product: true } }, returns: true, invoices: { where: { type: { not: "credit_note" } } } },
        })
        if (!order) throw new OrderError("not_found")
        if (order.status !== "delivered") throw new OrderError("not_delivered")

        let plan: ReturnPlan
        try {
          plan = planReturn(
            order.items as DeliveredLine[],
            order.returns.map((r) => asLines(r.items)),
            input.items,
            {
              refundDeliveryFee: input.refundDeliveryFee,
              orderDeliveryFeePaise: order.deliveryFeePaise,
              deliveryFeeAlreadyRefunded: order.returns.some((r) => r.deliveryFeePaise > 0),
            }
          )
        } catch (e) {
          if (e instanceof ReturnError) throw new OrderError(e.code)
          throw e
        }

        const restock = input.restock && features.stockTracking
        if (restock) {
          for (const l of plan.lines) await tx.product.updateMany({ where: { id: l.productId }, data: { stockQty: { increment: l.qty } } })
        }

        const invoice = order.invoices[0]
        const creditNote =
          features.invoices && invoice
            ? await issueCreditNote(tx, tenantId, tenant.invoicePrefix, order, invoice, plan, input.reason, now)
            : null

        const ret = await tx.orderReturn.create({
          data: {
            tenantId,
            orderId,
            items: plan.lines.map(({ productId, qty, unitPricePaise, gstRate }) => ({ productId, qty, unitPricePaise, gstRate })),
            reason: input.reason,
            note: input.note || null,
            amountPaise: plan.totalPaise,
            deliveryFeePaise: plan.deliveryFeePaise,
            refundMethod: input.refundMethod,
            restocked: restock,
            creditNoteId: creditNote?.id ?? null,
            byStaffId,
            at: now,
          },
        })

        await tx.ledgerEntry.create({
          data: { tenantId, customerId: order.customerId, type: "credit_note", amountPaise: plan.totalPaise, refType: "return", refId: ret.id, note: input.reason },
        })
        if (input.refundMethod !== "account" && plan.totalPaise > 0) {
          const refund = await tx.payment.create({
            data: {
              tenantId,
              customerId: order.customerId,
              orderId,
              method: input.refundMethod === "cash" ? "cash_on_delivery" : "upi_on_delivery",
              amountPaise: plan.totalPaise,
              status: "refunded",
              collectedById: byStaffId,
              note: `refund:${ret.id}`,
            },
          })
          await tx.ledgerEntry.create({
            data: { tenantId, customerId: order.customerId, type: "refund", amountPaise: plan.totalPaise, refType: "payment", refId: refund.id },
          })
        }
        await tx.orderEvent.create({
          data: { tenantId, orderId, fromStatus: "delivered", toStatus: "delivered", byStaffId, note: `return:${input.reason}` },
        })
        return { ret, creditNote, plan }
      })
    } catch (e) {
      // Two credit notes took the same number at once: retry with the next one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
      throw e
    }
  }
  throw new OrderError("busy_try_again")
}

async function issueCreditNote(
  tx: TenantTx,
  tenantId: string,
  prefix: string,
  order: { id: string; number: number; customerId: string; items: { productId: string; product: { nameTa: string; nameEn: string; packTa: string; packEn: string; hsn: string | null } }[] },
  invoice: { id: string; number: string; snapshot: Prisma.JsonValue },
  plan: ReturnPlan,
  reason: ReturnReason,
  now: Date
) {
  const original = readSnapshot(invoice.snapshot)
  const fy = financialYear(now)
  const seq = await nextSeq(tx, tenantId, "CN", fy)
  const number = creditNoteNumber(prefix, fy, seq)
  const product = new Map(order.items.map((i) => [i.productId, i.product]))

  const snapshot = buildInvoiceSnapshot({
    number,
    issuedAt: now,
    orderCode: orderCode(prefix, order.number),
    // The parties as printed on the original invoice.
    farm: original.farm,
    customer: original.customer,
    lines: plan.lines.map((l) => {
      const p = product.get(l.productId)!
      return { nameTa: p.nameTa, nameEn: p.nameEn, packTa: p.packTa, packEn: p.packEn, hsn: p.hsn, qty: l.qty, unitPricePaise: l.unitPricePaise, gstRate: l.gstRate }
    }),
    deliveryFeePaise: plan.deliveryFeePaise,
    creditNoteFor: { number: invoice.number, type: original.type === "tax_invoice" ? "tax_invoice" : "bill_of_supply", reason },
  })

  return tx.invoice.create({
    data: {
      tenantId,
      orderId: order.id,
      customerId: order.customerId,
      type: "credit_note",
      number,
      fy,
      seq,
      totalPaise: snapshot.totalPaise,
      taxPaise: snapshot.taxPaise,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      publicToken: randomBytes(18).toString("base64url"),
      refInvoiceId: invoice.id,
      issuedAt: now,
    },
  })
}
