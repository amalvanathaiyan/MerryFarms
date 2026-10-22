import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { OrderError } from "./orders"

export const MAX_MESSAGE_LENGTH = 1000
/** A customer can't send more than this many messages an hour (stops accidental floods and spam). */
export const CUSTOMER_HOURLY_LIMIT = 20

function cleanBody(body: string) {
  const text = body.replace(/\s+$/g, "").replace(/^\s+/g, "")
  if (!text) throw new OrderError("message_empty")
  if (text.length > MAX_MESSAGE_LENGTH) throw new OrderError("message_too_long")
  return text
}

export async function sendFromCustomer(tenantId: string, customerId: string, body: string, orderId?: string) {
  const db = tenantDb(tenantId)
  const recent = await db.message.count({ where: { customerId, sender: "customer", createdAt: { gte: new Date(Date.now() - 3_600_000) } } })
  if (recent >= CUSTOMER_HOURLY_LIMIT) throw new OrderError("message_rate_limited")
  if (orderId && !(await db.order.findFirst({ where: { id: orderId, customerId }, select: { id: true } }))) throw new OrderError("not_found")
  return db.message.create({ data: { tenantId, customerId, sender: "customer", body: cleanBody(body), orderId: orderId ?? null } })
}

export async function sendFromFarm(tenantId: string, customerId: string, body: string, byStaffId: string) {
  const db = tenantDb(tenantId)
  if (!(await db.customer.findFirst({ where: { id: customerId }, select: { id: true } }))) throw new OrderError("customer_not_found")
  return db.message.create({ data: { tenantId, customerId, sender: "farm", body: cleanBody(body), byStaffId } })
}

/** The viewer opened the conversation: the other side's messages are now "Seen". */
export async function markSeen(tenantId: string, customerId: string, viewer: "customer" | "farm") {
  await tenantDb(tenantId).message.updateMany({
    where: { customerId, sender: viewer === "farm" ? "customer" : "farm", seenAt: null },
    data: { seenAt: new Date() },
  })
}

export async function thread(tenantId: string, customerId: string, take = 100) {
  const rows = await tenantDb(tenantId).message.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take })
  return rows.reverse()
}

/** Customer messages the farm hasn't opened yet (badge on the farm app). */
export const unreadForFarm = (tenantId: string) => tenantDb(tenantId).message.count({ where: { sender: "customer", seenAt: null } })

/** Farm replies this customer hasn't opened yet (red dot on My orders). */
export const unreadForCustomer = (tenantId: string, customerId: string) =>
  tenantDb(tenantId).message.count({ where: { customerId, sender: "farm", seenAt: null } })

export interface InboxRow {
  customerId: string
  customerName: string
  phone: string
  last: { body: string; sender: "customer" | "farm"; at: Date; seenAt: Date | null }
  unread: number
  /** The customer spoke last and is waiting for the farm's answer, since this time. */
  waitingSince: Date | null
}

/** One row per conversation, newest first. */
export async function inbox(tenantId: string, take = 100): Promise<InboxRow[]> {
  const db = tenantDb(tenantId)
  const latest = await db.message.findMany({
    distinct: ["customerId"],
    orderBy: [{ customerId: "asc" }, { createdAt: "desc" }],
    include: { customer: { select: { name: true, phone: true } } },
  })
  const unread = await db.message.groupBy({ by: ["customerId"], where: { sender: "customer", seenAt: null }, _count: { _all: true } })
  const unreadBy = new Map(unread.map((u) => [u.customerId, u._count._all]))

  // For conversations where the customer spoke last, when did their unanswered run start?
  const waiting = latest.filter((m) => m.sender === "customer")
  const lastFarm = waiting.length
    ? await db.message.groupBy({ by: ["customerId"], where: { sender: "farm", customerId: { in: waiting.map((m) => m.customerId) } }, _max: { createdAt: true } })
    : []
  const lastFarmBy = new Map(lastFarm.map((r) => [r.customerId, r._max.createdAt]))
  const firstUnanswered = new Map<string, Date>()
  for (const m of waiting) {
    const after = lastFarmBy.get(m.customerId) ?? new Date(0)
    const first = await db.message.findFirst({ where: { customerId: m.customerId, sender: "customer", createdAt: { gt: after } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } })
    if (first) firstUnanswered.set(m.customerId, first.createdAt)
  }

  return latest
    .map((m) => ({
      customerId: m.customerId,
      customerName: m.customer.name,
      phone: m.customer.phone,
      last: { body: m.body, sender: m.sender, at: m.createdAt, seenAt: m.seenAt },
      unread: unreadBy.get(m.customerId) ?? 0,
      waitingSince: firstUnanswered.get(m.customerId) ?? null,
    }))
    .sort((a, b) => b.last.at.getTime() - a.last.at.getTime())
    .slice(0, take)
}
