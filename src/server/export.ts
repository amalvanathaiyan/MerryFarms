import "server-only"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"

/**
 * Everything a farm owns, as one JSON-ready object ("Download all my data").
 * Left out on purpose: keys and tokens (personal links, invoice links, WhatsApp token),
 * sign-in codes, phone-notification addresses and photo bytes.
 */
export async function exportFarm(tenantId: string) {
  const db = tenantDb(tenantId)
  const farm = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    omit: { whatsappAccessToken: true, whatsappPhoneNumberId: true, whatsappWabaId: true },
  })
  const [settings, categories, products, slots, closedDays, customers, addresses, orders, orderEvents, calls, invoices, payments, ledger, returns, plans, messages, templates, staff] =
    await Promise.all([
      db.tenantSettings.findFirst(),
      db.category.findMany({ orderBy: { sortOrder: "asc" } }),
      db.product.findMany({ orderBy: { sortOrder: "asc" } }),
      db.deliverySlot.findMany(),
      db.closedDay.findMany({ orderBy: { date: "asc" } }),
      db.customer.findMany({ omit: { accessToken: true, tokenIssuedAt: true }, orderBy: { createdAt: "asc" } }),
      db.address.findMany(),
      db.order.findMany({ include: { items: true }, orderBy: { number: "asc" } }),
      db.orderEvent.findMany({ orderBy: { at: "asc" } }),
      db.confirmationCall.findMany({ orderBy: { at: "asc" } }),
      db.invoice.findMany({ omit: { publicToken: true }, orderBy: { issuedAt: "asc" } }),
      db.payment.findMany({ orderBy: { at: "asc" } }),
      db.ledgerEntry.findMany({ orderBy: { at: "asc" } }),
      db.orderReturn.findMany({ orderBy: { at: "asc" } }),
      db.subscription.findMany(),
      db.message.findMany({ orderBy: { createdAt: "asc" } }),
      db.messageTemplate.findMany(),
      db.staffMember.findMany({ select: { id: true, name: true, email: true, phone: true, roles: true, isActive: true, createdAt: true } }),
    ])
  return {
    format: "farmforyou-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Money is in paise (100 paise = ₹1). Dates of delivery are IST.",
    farm,
    settings,
    categories,
    products,
    deliverySlots: slots,
    closedDays,
    customers,
    addresses,
    orders,
    orderEvents,
    confirmationCalls: calls,
    invoices,
    payments,
    ledger,
    returns,
    plans,
    messages,
    messageTemplates: templates,
    staff,
  }
}
