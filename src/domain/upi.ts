/**
 * UPI payment links (NPCI deep link). Opens any UPI app (GPay, PhonePe, Paytm, BHIM)
 * with the farm's UPI ID and the amount filled in. No gateway, no fee.
 */

const UPI_ID = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/

export function isValidUpiId(v: string): boolean {
  return UPI_ID.test(v.trim())
}

export function upiPayLink(opts: { upiId: string; payeeName: string; amountPaise: number; note?: string }): string {
  const params = new URLSearchParams({
    pa: opts.upiId.trim(),
    pn: opts.payeeName,
    am: (opts.amountPaise / 100).toFixed(2),
    cu: "INR",
  })
  if (opts.note) params.set("tn", opts.note.slice(0, 50))
  return `upi://pay?${params.toString()}`
}
