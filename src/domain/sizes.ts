/**
 * Price per quantity (docs/platform-plan.md §3.3): one product sold in several sizes, each with its own price and
 * stock (1 kg ₹X, ½ kg ₹Y; 6 eggs, tray of 30). Each size is its own product row, so orders, stock, the egg store,
 * offers and invoices work per size as they always have. Sizes are the products in the same category with the same
 * Tamil and English name; the shop and the catalogue show them as one product with size buttons. Pure, so it is tested.
 */

const norm = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()

/** The family a product belongs to: its category and its names (spacing and case don't matter). */
export const sizeFamily = (p: { categoryId: string; nameTa: string; nameEn: string }) => `${p.categoryId}|${norm(p.nameTa)}|${norm(p.nameEn)}`

/** Products grouped into families, in the order the first size of each comes (the farm's own order). `keyOf`: the
 *  family, when it's already worked out (the shop gets it from the server). */
export function groupSizes<T>(products: T[], keyOf: (p: T) => string): { key: string; sizes: T[] }[] {
  const out = new Map<string, T[]>()
  for (const p of products) {
    const k = keyOf(p)
    const list = out.get(k)
    if (list) list.push(p)
    else out.set(k, [p])
  }
  return [...out].map(([key, sizes]) => ({ key, sizes }))
}

/** The size shown first: the first one still in stock, else the first. */
export function firstSize<T extends { stockQty: number }>(sizes: T[], tracksStock: boolean): T {
  return (tracksStock && sizes.find((s) => s.stockQty > 0)) || sizes[0]
}
