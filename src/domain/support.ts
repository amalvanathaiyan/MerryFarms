/**
 * Support mode: a FarmForYou super admin working inside one farm's app to fix something, signed in as themselves
 * (never as the farm). Pure rules, so they are tested. The visit itself lives in src/server/support.ts.
 */

/** How long a visit lasts before it ends by itself. */
export const SUPPORT_MINUTES = 60

export interface VisitState {
  tenantId: string
  endsAt: Date
  endedAt: Date | null
}

/** A visit lets the admin in while it is for this farm, not ended, and not past its time. */
export function visitOpen(v: VisitState, tenantId: string, now: Date): boolean {
  return v.tenantId === tenantId && v.endedAt == null && v.endsAt.getTime() > now.getTime()
}

/** What the farm admin reads in the log: the kind of record, grouped into words a farm uses. */
const AREAS: Record<string, string> = {
  Order: "orders", OrderItem: "orders", OrderEvent: "orders", ConfirmationCall: "orders", OrderReturn: "orders", Subscription: "orders",
  Invoice: "money", InvoiceCounter: "money", LedgerEntry: "money", Payment: "money", Expense: "money", ProductionEntry: "money",
  Product: "products", Category: "products", ProductImage: "products",
  Customer: "customers", Address: "customers", Message: "customers",
  DeliverySlot: "delivery", ClosedDay: "delivery",
  Batch: "poultry", BatchDay: "poultry", BatchLoss: "poultry", VaccineScheduleItem: "poultry", BatchVaccination: "poultry", BatchWeight: "poultry",
  Tenant: "settings", TenantSettings: "settings", TenantLogo: "settings", MessageTemplate: "settings", FarmVideo: "settings",
}
export type SupportArea = "orders" | "money" | "products" | "customers" | "delivery" | "poultry" | "settings" | "other"
export const areaOf = (model: string): SupportArea => (AREAS[model] as SupportArea | undefined) ?? "other"

export type ChangeKind = "added" | "changed" | "removed"
export function kindOf(operation: string): ChangeKind {
  if (operation.startsWith("create")) return "added"
  if (operation.startsWith("delete")) return "removed"
  return "changed" // update, updateMany, upsert
}

/** A visit's changes, counted by area and kind, in a steady order for the log. */
export function summarise(changes: { model: string; operation: string }[]): { area: SupportArea; kind: ChangeKind; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of changes) {
    const key = `${areaOf(c.model)}|${kindOf(c.operation)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([k, count]) => {
      const [area, kind] = k.split("|") as [SupportArea, ChangeKind]
      return { area, kind, count }
    })
    .sort((a, b) => a.area.localeCompare(b.area) || a.kind.localeCompare(b.kind))
}

/** Writes worth logging (reads never are). */
export const WRITE_OPS = new Set(["create", "createMany", "createManyAndReturn", "update", "updateMany", "updateManyAndReturn", "upsert", "delete", "deleteMany"])
