import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/** Who did something: Farm For You admin, a farm's staff member (or support standing in as one), a customer, the app. */
export interface Actor {
  kind: "platform_admin" | "staff" | "customer" | "system"
  id: string | null
  name: string | null
  /** Farm For You support inside a farm's app */
  viaSupport?: boolean
}

export interface AuditInput {
  tenantId: string | null
  action: string
  subject?: string | null
  before?: unknown
  after?: unknown
}

type Db = Pick<Prisma.TransactionClient, "auditEntry">

const json = (v: unknown) => (v === undefined || v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue))

/** The audit log row for one change (who, when, old and new value). Pass a transaction to keep it with the change. */
export function auditData(actor: Actor, e: AuditInput): Prisma.AuditEntryCreateManyInput {
  return {
    tenantId: e.tenantId,
    actorKind: actor.kind,
    actorId: actor.id,
    actorName: actor.name,
    viaSupport: !!actor.viaSupport,
    action: e.action,
    subject: e.subject ?? null,
    before: json(e.before),
    after: json(e.after),
  }
}

/** Records changes in the audit log. Never throws: a log line must never undo the change it records. */
export async function audit(actor: Actor, entries: AuditInput[], db: Db = prisma) {
  if (!entries.length) return
  try {
    await db.auditEntry.createMany({ data: entries.map((e) => auditData(actor, e)) })
  } catch (e) {
    console.error("[audit]", (e as Error).message)
  }
}

/** The staff member (or support visit) acting in a farm's app, as an actor. */
export function staffActor(staff: { id: string; name: string | null }, support: unknown): Actor {
  // Support's stand-in id ("support-<visit>") ties the change to the visit
  return { kind: "staff", id: staff.id, name: staff.name, viaSupport: !!support }
}

/** A farm's recent changes, newest first (optionally only some actions). */
export function recentAudit(tenantId: string | null, opts: { actions?: string[]; take?: number } = {}) {
  return prisma.auditEntry.findMany({
    where: { tenantId, ...(opts.actions ? { action: { in: opts.actions } } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 10,
  })
}
