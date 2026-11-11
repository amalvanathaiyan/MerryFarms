/**
 * Support mode against a real Postgres (PGlite over a local socket): the signed cookie, starting and ending a visit,
 * an hour's limit, and every write inside a visit logged for the farm (and only for that farm).
 * The browser's cookies are stood in for by a small jar.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const jar = new Map<string, string>()
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void jar.set(name, value),
  }),
}))

const PORT = 54341
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let support: typeof import("./support")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb

const tenantRow = (id: string) => ({
  id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan: "pro" as const, defaultLanguage: "ta" as const,
  phone: "+919000050001", invoicePrefix: "MF", whatsappMode: "lite" as const, deliveryFeePaise: 0, freeAbovePaise: 0,
})
const ADMIN = { id: "a1", authUserId: "auth-a1", name: "Amal (FarmForYou)" }

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as { code?: string }).code ?? String(e)
  }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  support = await import("./support")
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  await prisma.tenant.createMany({ data: [tenantRow("t1"), tenantRow("t2")] })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

beforeEach(() => jar.clear())

describe("support mode", () => {
  it("signs the visit cookie so it can't be made up", () => {
    const value = support.cookieValue("visit-1")
    expect(support.visitIdFrom(value)).toBe("visit-1")
    expect(support.visitIdFrom(value.replace("visit-1", "visit-2"))).toBeNull()
    expect(support.visitIdFrom("visit-1.0000")).toBeNull()
    expect(support.visitIdFrom(undefined)).toBeNull()
  })

  it("needs a reason, and ends by itself after an hour", async () => {
    expect(await code(support.startVisit(ADMIN, "t1", "  "))).toBe("support_reason")
    expect(await code(support.startVisit(ADMIN, "nope", "Fixing an order"))).toBe("not_found")
    const now = new Date("2026-11-11T10:00:00Z")
    const v = await support.startVisit(ADMIN, "t1", "Owner called: Tuesday's order is missing", now)
    expect(v).toMatchObject({ tenantId: "t1", adminAuthUserId: "auth-a1", adminName: ADMIN.name, endedAt: null })
    expect(v.endsAt.getTime() - now.getTime()).toBe(60 * 60_000)
    // That hour is long past: the cookie no longer opens the farm.
    jar.set(support.SUPPORT_COOKIE, support.cookieValue(v.id))
    expect(await support.openVisitFor("t1")).toBeNull()
  })

  it("logs every write during a visit, for that farm only, and stops when the visit ends", async () => {
    const v = await support.startVisit(ADMIN, "t1", "Prices are wrong on the shop")
    jar.set(support.SUPPORT_COOKIE, support.cookieValue(v.id))
    expect((await support.openVisitFor("t1"))?.id).toBe(v.id)
    expect(await support.openVisitFor("t2")).toBeNull()

    const cat = await tenantDb("t1").category.create({ data: { tenantId: "t1", nameTa: "முட்டை", nameEn: "Eggs" } })
    await tenantDb("t1").category.updateMany({ where: { id: cat.id }, data: { nameEn: "Country eggs" } })
    await tenantDb("t1").category.findMany() // reads are never logged
    await tenantDb("t2").category.create({ data: { tenantId: "t2", nameTa: "பால்", nameEn: "Milk" } }) // another farm

    const logged = await prisma.supportChange.findMany({ where: { visitId: v.id }, orderBy: { createdAt: "asc" } })
    expect(logged.map((c) => [c.tenantId, c.model, c.operation])).toEqual([["t1", "Category", "create"], ["t1", "Category", "updateMany"]])
    expect(logged[0].recordId).toBe(cat.id)

    await support.endVisit(v.id)
    await tenantDb("t1").category.create({ data: { tenantId: "t1", nameTa: "கோழி", nameEn: "Chicken" } })
    expect(await prisma.supportChange.count({ where: { visitId: v.id } })).toBe(2)
  })

  it("never logs anything without a visit cookie (the farm's own staff)", async () => {
    const before = await prisma.supportChange.count()
    await tenantDb("t1").category.create({ data: { tenantId: "t1", nameTa: "தேன்", nameEn: "Honey" } })
    expect(await prisma.supportChange.count()).toBe(before)
  })

  it("shows the farm each visit with its changes counted by area", async () => {
    const visits = await support.listVisits("t1")
    expect(visits.length).toBeGreaterThanOrEqual(2)
    const withChanges = visits.find((v) => v.reason === "Prices are wrong on the shop")!
    expect(withChanges).toMatchObject({ open: false, total: 2 })
    expect(withChanges.finishedAt).not.toBeNull()
    expect(withChanges.changes).toEqual([{ area: "products", kind: "added", count: 1 }, { area: "products", kind: "changed", count: 1 }])
    expect(await support.listVisits("t2")).toEqual([])
  })
})
