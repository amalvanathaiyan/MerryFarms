/**
 * Indian mobile numbers to E.164 ("+919000010001").
 * Accepts "90000 10001", "+91 90000 10001", "09000010001", "919000010001".
 * Returns null for anything that is not a valid Indian mobile (starts 6–9, 10 digits).
 */
export function normaliseIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  if (!/^[6-9]\d{9}$/.test(digits)) return null
  return `+91${digits}`
}

/** "+91 90000 10001" for display. */
export function formatIndianMobile(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10)
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
}
