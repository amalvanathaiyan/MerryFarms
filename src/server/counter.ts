import "server-only"
import type { Tenant } from "@/lib/tenant"
import { COUNTER_PHONE } from "@/domain/customers"
import { deliverOrder } from "./billing"
import { placeOrder } from "./orders"

export interface CounterSale {
  items: { productId: string; qty: number }[]
  paid: "cash" | "upi"
  /** Prices agreed at the counter, in paise, by product id (checked against the list price). */
  prices?: Record<string, number>
}

/**
 * A quick sale at the farm or a market stall: no name, no address, no slot. It's an order that is delivered and paid
 * at once (stock comes off, the money shows in Money, an invoice is made when the farm uses them), to the farm's
 * stand-in counter customer.
 */
export async function sellAtCounter(tenant: Tenant, byStaffId: string, sale: CounterSale, now = new Date()) {
  const { order } = await placeOrder(
    tenant,
    {
      channel: "walk_in",
      customer: { phone: COUNTER_PHONE, name: tenant.defaultLanguage === "en" ? "Counter sale" : "கவுண்டர் விற்பனை", language: tenant.defaultLanguage },
      address: null,
      items: sale.items,
      slotKey: null,
      paymentMethod: sale.paid === "upi" ? "upi_on_delivery" : "cash_on_delivery",
      byStaffId,
      staffOverride: true,
      prices: sale.prices,
    },
    now
  )
  const { invoice } = await deliverOrder(tenant.id, order.id, sale.paid, byStaffId, now)
  return { orderId: order.id, number: order.number, totalPaise: order.totalPaise, invoiceId: invoice?.id ?? null }
}
