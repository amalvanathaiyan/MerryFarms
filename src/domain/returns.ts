/**
 * Returns and short deliveries after an order was delivered.
 * Refunds are always at the price agreed on the order, never today's price.
 */

export interface DeliveredLine {
  productId: string
  qty: number
  unitPricePaise: number
  gstRate: number
}

export interface ReturnLine extends DeliveredLine {
  amountPaise: number
}

export interface ReturnPlan {
  lines: ReturnLine[]
  goodsPaise: number
  deliveryFeePaise: number
  totalPaise: number
  /** True when, after this return, nothing from the order is left with the customer. */
  fullyReturned: boolean
}

/** How many of each product can still be returned. */
export function returnable(delivered: DeliveredLine[], earlierReturns: { productId: string; qty: number }[][]): Map<string, number> {
  const left = new Map<string, number>()
  for (const l of delivered) left.set(l.productId, (left.get(l.productId) ?? 0) + l.qty)
  for (const r of earlierReturns) for (const i of r) left.set(i.productId, (left.get(i.productId) ?? 0) - i.qty)
  return left
}

export class ReturnError extends Error {
  constructor(public code: "nothing_to_return" | "too_many_returned" | "not_on_order" | "fee_needs_full_return") {
    super(code)
  }
}

/**
 * Prices a return. The delivery charge can be refunded only when the whole order
 * comes back (a failed or wrong delivery), and only once.
 */
export function planReturn(
  delivered: DeliveredLine[],
  earlierReturns: { productId: string; qty: number }[][],
  request: { productId: string; qty: number }[],
  opts: { refundDeliveryFee: boolean; orderDeliveryFeePaise: number; deliveryFeeAlreadyRefunded: boolean }
): ReturnPlan {
  const wanted = new Map<string, number>()
  for (const r of request) if (r.qty > 0) wanted.set(r.productId, (wanted.get(r.productId) ?? 0) + r.qty)
  if (wanted.size === 0 && !opts.refundDeliveryFee) throw new ReturnError("nothing_to_return")

  const left = returnable(delivered, earlierReturns)
  const lines: ReturnLine[] = []
  for (const [productId, qty] of wanted) {
    const line = delivered.find((d) => d.productId === productId)
    if (!line) throw new ReturnError("not_on_order")
    if (!Number.isInteger(qty) || qty > (left.get(productId) ?? 0)) throw new ReturnError("too_many_returned")
    lines.push({ ...line, qty, amountPaise: qty * line.unitPricePaise })
  }

  const fullyReturned = [...left.entries()].every(([id, q]) => (wanted.get(id) ?? 0) >= q)
  let deliveryFeePaise = 0
  if (opts.refundDeliveryFee) {
    if (!fullyReturned) throw new ReturnError("fee_needs_full_return")
    deliveryFeePaise = opts.deliveryFeeAlreadyRefunded ? 0 : opts.orderDeliveryFeePaise
  }
  const goodsPaise = lines.reduce((a, l) => a + l.amountPaise, 0)
  return { lines, goodsPaise, deliveryFeePaise, totalPaise: goodsPaise + deliveryFeePaise, fullyReturned }
}
