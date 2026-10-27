import { includedTax } from "./money"

export interface PricedLine {
  qty: number
  unitPricePaise: number // GST-inclusive
  gstRate: number
}

export interface DeliveryRule {
  deliveryFeePaise: number
  freeAbovePaise: number // 0 = delivery is never free
}

export interface OrderTotals {
  subtotalPaise: number
  deliveryFeePaise: number
  totalPaise: number
  /** GST included in the item prices, grouped by rate (exempt items omitted). */
  taxByRate: Record<number, number>
  taxPaise: number
}

export function deliveryFee(subtotalPaise: number, rule: DeliveryRule): number {
  if (subtotalPaise <= 0 || rule.deliveryFeePaise <= 0) return 0
  if (rule.freeAbovePaise > 0 && subtotalPaise >= rule.freeAbovePaise) return 0
  return rule.deliveryFeePaise
}

export function orderTotals(lines: PricedLine[], rule: DeliveryRule): OrderTotals {
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new Error(`Invalid quantity: ${l.qty}`)
  }
  const subtotalPaise = lines.reduce((sum, l) => sum + l.qty * l.unitPricePaise, 0)
  const fee = deliveryFee(subtotalPaise, rule)

  const taxByRate: Record<number, number> = {}
  for (const l of lines) {
    if (l.gstRate <= 0) continue
    taxByRate[l.gstRate] = (taxByRate[l.gstRate] ?? 0) + includedTax(l.qty * l.unitPricePaise, l.gstRate)
  }
  const taxPaise = Object.values(taxByRate).reduce((a, b) => a + b, 0)

  return { subtotalPaise, deliveryFeePaise: fee, totalPaise: subtotalPaise + fee, taxByRate, taxPaise }
}
