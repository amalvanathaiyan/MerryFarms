import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Records something that happened (order.placed, request.created, settings.changed…): the activity log in admin, and
 * what automation rules react to (docs/platform-plan.md §5). Never throws: a log line must never break what caused it.
 */
export async function emitEvent(type: string, tenantId: string | null, data: Record<string, unknown> = {}) {
  try {
    await prisma.platformEvent.create({ data: { type, tenantId, data: data as Prisma.InputJsonValue } })
  } catch (e) {
    console.error("[event]", type, (e as Error).message)
  }
}
