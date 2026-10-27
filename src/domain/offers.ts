/**
 * Product prices: the list price, an optional offer price with an end date, bulk price
 * changes, and the limits on a price staff agree with a customer.
 */

export interface Priced {
  pricePaise: number
  offerPricePaise: number | null
  /** Last IST day the offer applies ("YYYY-MM-DD"); null = until removed. */
  offerEndsOn: string | null
}

export function offerActive(p: Priced, today: string): boolean {
  if (p.offerPricePaise == null || p.offerPricePaise <= 0 || p.offerPricePaise >= p.pricePaise) return false
  return p.offerEndsOn == null || today <= p.offerEndsOn
}

/** What a customer pays today. */
export function currentPrice(p: Priced, today: string): number {
  return offerActive(p, today) ? p.offerPricePaise! : p.pricePaise
}

/** Whole-number "% off" for the badge, e.g. 390 → 360 is 8%. */
export function percentOff(p: Priced): number {
  if (p.offerPricePaise == null || p.offerPricePaise >= p.pricePaise) return 0
  return Math.round(((p.pricePaise - p.offerPricePaise) / p.pricePaise) * 100)
}

export type Adjust = { mode: "pct" | "rupees"; direction: "up" | "down"; amount: number }

/**
 * A bulk price change, rounded to the nearest rupee (prices stay simple to say on a call).
 * Never goes below ₹1.
 */
export function adjustPrice(pricePaise: number, a: Adjust): number {
  const sign = a.direction === "up" ? 1 : -1
  const next = a.mode === "pct" ? pricePaise * (1 + (sign * a.amount) / 100) : pricePaise + sign * a.amount * 100
  return Math.max(100, Math.round(next / 100) * 100)
}

/** A price staff agree for one order: at least ₹1, and never above the list price. */
export function validAgreedPrice(paise: number, listPricePaise: number): boolean {
  return Number.isInteger(paise) && paise >= 100 && paise <= listPricePaise
}
