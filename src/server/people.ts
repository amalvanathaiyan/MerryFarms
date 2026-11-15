import "server-only"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"

/**
 * One person across Farm For You (docs/platform-plan.md §3.4). A phone number becomes a PlatformPerson only when it is
 * proven with a sign-in code; each farm's Customer record for that number then points at it. Farms never read this
 * table: only the person, right after proving the number, gets their own name and language back.
 */

/**
 * The customer just proved their phone: mark it, and join them to the person with that number (made the first time,
 * from this farm's record). The farm's own record (credit, notes, staff-made history) stays as it is.
 */
export async function phoneProven(tenantId: string, customerId: string, now = new Date()) {
  const db = tenantDb(tenantId)
  const c = await db.customer.findFirst({ where: { id: customerId }, select: { phone: true, name: true, language: true } })
  if (!c) return null
  const person = await prisma.platformPerson.upsert({
    where: { phone: c.phone },
    update: {},
    create: { phone: c.phone, name: c.name, language: c.language },
  })
  await db.customer.updateMany({ where: { id: customerId }, data: { personId: person.id, phoneVerifiedAt: now } })
  return person.id
}

/** For someone who just proved this number and is new to this farm: the name and language they gave elsewhere. */
export async function knownPerson(phone: string) {
  return prisma.platformPerson.findUnique({ where: { phone }, select: { name: true, language: true } })
}
