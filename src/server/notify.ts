import "server-only"

/**
 * Phone notifications (web push) for staff and customers.
 * Placeholder until step 3 adds push subscriptions: sending is a no-op today, so
 * messages still work and are noticed through badges, "Seen" ticks and the call fallback.
 */
export interface Note {
  title: string
  body: string
  url: string
}

export async function notifyStaff(tenantId: string, note: Note): Promise<void> {
  void tenantId
  void note
}

export async function notifyCustomer(tenantId: string, customerId: string, note: Note): Promise<void> {
  void tenantId
  void customerId
  void note
}
