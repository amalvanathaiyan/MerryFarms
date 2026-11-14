/**
 * Farm Core's store (docs/platform-plan.md §3.2), the pure part: what the farm buys and uses up (feed, seed,
 * fertiliser, medicine, packing), how much is left, what it cost on average, and when it is running low. Tested;
 * src/server/inputs.ts loads and saves.
 *
 * Bought = spending in Money with the item and its quantity, so nothing is entered twice. Used = taken out of the
 * store (on a place, say fertiliser on a plot). A count puts the store right when what's really there differs: it
 * is saved as the change. The hens' feed is one item (batchFeed); what batches are given in the daily entry comes
 * out of it, and each batch's feed cost is that kg at the item's average price, as the feed store always did.
 */

export const INPUT_KINDS = ["feed", "seed", "fertiliser", "medicine", "packing", "other"] as const
export type InputKind = (typeof INPUT_KINDS)[number]
export const INPUT_UNITS = ["kg", "litre", "bag", "packet", "bottle", "piece"] as const
export type InputUnit = (typeof INPUT_UNITS)[number]
export const USE_KINDS = ["used", "count"] as const

/** The spending kind in Money for buying an item of this kind (see EXPENSE_KINDS in src/domain/records.ts). */
export function expenseKindFor(kind: string) {
  switch (kind) {
    case "feed":
      return "feed"
    case "seed":
    case "fertiliser":
      return "seeds"
    case "medicine":
      return "medicine"
    case "packing":
      return "packing"
    default:
      return "raw_materials"
  }
}

const round = (n: number) => Math.round(n * 100) / 100

export interface InputStock {
  bought: number
  /** Used from the store, including (hen feed) what batches were given. */
  used: number
  /** Counts that put the store right, together (+ found more, - found less). */
  counted: number
  /** Can go below 0 when a purchase wasn't entered. */
  left: number
  /** Average price paid for one unit; null until something is bought with its quantity. */
  pricePaise: number | null
}

/** Bought (purchases with their quantity), used and counted, into what is left and the average price. */
export function inputStock(purchases: { quantity: number | null; amountPaise: number }[], uses: { kind: string; quantity: number }[], batchFedKg = 0): InputStock {
  const withQty = purchases.filter((p) => p.quantity != null && p.quantity > 0)
  const bought = withQty.reduce((a, p) => a + p.quantity!, 0)
  const paid = withQty.reduce((a, p) => a + p.amountPaise, 0)
  const used = uses.filter((u) => u.kind === "used").reduce((a, u) => a + u.quantity, 0) + batchFedKg
  const counted = uses.filter((u) => u.kind === "count").reduce((a, u) => a + u.quantity, 0)
  return { bought: round(bought), used: round(used), counted: round(counted), left: round(bought - used + counted), pricePaise: bought > 0 ? Math.round(paid / bought) : null }
}

/** The change to save when the store is counted: what's really there against what the book says. */
export const countChange = (left: number, counted: number) => round(counted - left)

/** Running low: at or below the item's warning level (no level, no warning). */
export const isLow = (left: number, lowAt: number | null) => lowAt != null && left <= lowAt

/** What a quantity used is worth at the average price; null without a price. */
export const worth = (quantity: number, pricePaise: number | null) => (pricePaise == null ? null : Math.round(quantity * pricePaise))

export const isInputKind = (k: string): k is InputKind => (INPUT_KINDS as readonly string[]).includes(k)
export const isInputUnit = (u: string): u is InputUnit => (INPUT_UNITS as readonly string[]).includes(u)

/** The hen-feed item's name when it is made for a farm, in the farm's own language (the farm can rename it). */
export const henFeedName = (language: string) => (language === "en" ? "Hen feed" : "கோழித் தீவனம்")
