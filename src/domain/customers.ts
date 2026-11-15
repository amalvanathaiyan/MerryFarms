/**
 * Customers, the pure part (docs/platform-plan.md §3.4): how a customer came to the farm, what kind of buyer they are,
 * and the consent log for offers. Tested; src/server/people.ts and src/server/customers.ts load and save.
 */

/** How a customer first came. "ffy": found the farm through Farm For You's directory. */
export const CUSTOMER_SOURCES = ["online", "whatsapp", "phone", "walk_in", "market", "referral", "ffy", "other"] as const
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number]

/** The ways staff can add a customer themselves (online and Farm For You come by themselves). */
export const STAFF_SOURCES = ["walk_in", "phone", "whatsapp", "market", "referral", "other"] as const satisfies readonly CustomerSource[]

/** What kind of buyer. Price lists per kind come with Selling v2. */
export const CUSTOMER_KINDS = ["home", "shop", "hotel", "wholesale", "institution"] as const
export type CustomerKind = (typeof CUSTOMER_KINDS)[number]

export const CONSENT_CHANNELS = ["whatsapp", "sms"] as const
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number]
/** "earlier": agreed before the log was kept (moved in once). */
export type ConsentHow = "shop" | "in_person" | "phone" | "earlier"

export const isCustomerSource = (s: unknown): s is CustomerSource => (CUSTOMER_SOURCES as readonly unknown[]).includes(s)
export const isCustomerKind = (s: unknown): s is CustomerKind => (CUSTOMER_KINDS as readonly unknown[]).includes(s)

/** How a customer made by an order came, from the order's channel. */
export function sourceOfChannel(channel: "web" | "whatsapp" | "phone" | "walk_in"): CustomerSource {
  return channel === "web" ? "online" : channel
}

/**
 * The consent rows a change of offers makes: one per channel whose answer changed, nothing when nothing did.
 */
export function consentChanges(
  before: { whatsapp: boolean; sms: boolean },
  after: { whatsapp: boolean; sms: boolean }
): { channel: ConsentChannel; given: boolean }[] {
  return CONSENT_CHANNELS.filter((c) => before[c] !== after[c]).map((c) => ({ channel: c, given: after[c] }))
}

/**
 * Counter sales (at the farm gate or a market stall) need no name: they go to one stand-in customer per farm, marked
 * by this phone value (never a real number, so nobody can sign in as it). Lists, search and counts leave it out.
 */
export const COUNTER_PHONE = "counter"
export const isCounter = (c: { phone: string }) => c.phone === COUNTER_PHONE
