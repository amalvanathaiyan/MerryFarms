import { prisma } from "@/lib/prisma"

/** Models that belong to a farm. Every query on them is pinned to one tenantId. */
const TENANT_MODELS = new Set([
  "TenantSettings",
  "StaffMember",
  "Category",
  "Product",
  "DeliverySlot",
  "Customer",
  "Address",
  "Order",
  "OrderItem",
  "OrderEvent",
  "ConfirmationCall",
  "Invoice",
  "InvoiceCounter",
  "LedgerEntry",
  "Payment",
  "OrderReturn",
  "MessageTemplate",
  "Subscription",
])

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
])

/**
 * A Prisma client that can only see and write one farm's rows.
 * - Reads, updates and deletes get `tenantId` added to `where`.
 * - Creates get `tenantId` added to `data`.
 *
 * Conventions this relies on:
 * - Use scalar foreign keys in creates (`customerId: x`), not `connect`.
 * - Nested creates (e.g. order items inside an order) must set `tenantId` themselves;
 *   the extension only sees the top-level operation.
 */
export function tenantDb(tenantId: string) {
  if (!tenantId) throw new Error("tenantDb needs a tenantId")
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = { ...(args as any) }
          if (WHERE_OPS.has(operation)) {
            a.where = { ...a.where, tenantId }
          } else if (operation === "create") {
            a.data = { ...a.data, tenantId }
          } else if (operation === "createMany" || operation === "createManyAndReturn") {
            const rows = Array.isArray(a.data) ? a.data : [a.data]
            a.data = rows.map((d: object) => ({ ...d, tenantId }))
          } else if (operation === "upsert") {
            a.where = { ...a.where, tenantId }
            a.create = { ...a.create, tenantId }
          }
          return query(a)
        },
      },
    },
  })
}

export type TenantDb = ReturnType<typeof tenantDb>

// Type-only helper: lets TypeScript pick the interactive overload of $transaction.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const txOf = (db: TenantDb) => db.$transaction(async (tx) => tx)

/** The client inside `tenantDb(id).$transaction(async (tx) => …)`, still tenant-scoped. */
export type TenantTx = Awaited<ReturnType<typeof txOf>>
