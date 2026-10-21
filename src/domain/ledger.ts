/**
 * Khata (customer credit account).
 * Entries store positive amounts with a type; adjustments carry their own sign.
 * Balance > 0 means the customer owes the farm; < 0 means the farm holds an advance.
 */

export type LedgerType = "charge" | "payment" | "adjustment"

export function signedAmount(type: LedgerType, amountPaise: number): number {
  if (type === "charge") return amountPaise
  if (type === "payment") return -amountPaise
  return amountPaise
}

export function ledgerBalance(entries: { type: LedgerType; amountPaise: number }[]): number {
  return entries.reduce((sum, e) => sum + signedAmount(e.type, e.amountPaise), 0)
}

/** Running balance after each entry, oldest first — what a statement prints. */
export function runningBalances<T extends { type: LedgerType; amountPaise: number }>(entries: T[]): (T & { balancePaise: number })[] {
  let balance = 0
  return entries.map((e) => {
    balance += signedAmount(e.type, e.amountPaise)
    return { ...e, balancePaise: balance }
  })
}

/**
 * Whether a new order may go on credit. 0 limit = this customer has no khata.
 * The order is allowed if the balance after it stays within the limit.
 */
export function withinCreditLimit(balancePaise: number, creditLimitPaise: number, orderTotalPaise: number): boolean {
  if (creditLimitPaise <= 0) return false
  return balancePaise + orderTotalPaise <= creditLimitPaise
}
