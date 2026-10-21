/** Money is held in paise (integers) everywhere; only formatting converts to rupees. */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** "₹1,23,450" with Indian digit grouping; paise shown only when not whole rupees. */
export function formatRupees(paise: number): string {
  const whole = paise % 100 === 0
  return (
    "₹" +
    (paise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: 2,
    })
  )
}

/** Tax included in a GST-inclusive amount, e.g. 5% inside ₹105 is ₹5. */
export function includedTax(grossPaise: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0
  return Math.round((grossPaise * ratePercent) / (100 + ratePercent))
}
