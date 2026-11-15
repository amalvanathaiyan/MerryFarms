/**
 * Customers across farms against a real Postgres (PGlite over a local socket): a proven number becomes one person
 * that each farm's own record points at; staff-added customers are never made twice and join up when the person signs
 * in online; offers are logged with who and how; the migration fills in how old customers came.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54381
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let customers: typeof import("./customers")
let people: typeof import("./people")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb

const farm = (id: string) => ({ id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan: "pro" as const, phone: "+919000090001", invoicePrefix: "TF" })
const staffForm = (over: Partial<import("./customers").StaffCustomerForm> = {}): import("./customers").StaffCustomerForm => ({
  name: "Murugan",
  phone: "+919000070001",
  language: "ta",
  source: "walk_in",
  kind: "hotel",
  whatsappOffers: true,
  smsOffers: false,
  consentHow: "in_person",
  address: null,
  ...over,
})

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  customers = await import("./customers")
  people = await import("./people")
  await prisma.tenant.createMany({ data: ["f1", "f2"].map(farm) })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("customers across farms", () => {
  it("adds a walk-in customer once, with how they came and their offers consent", async () => {
    const db = tenantDb("f1")
    const a = await customers.addCustomerByStaff(db, "f1", "staff-1", staffForm({ address: { line: "12, Bazaar Street", pincode: "600001" } }))
    expect(a.status).toBe("added")
    const again = await customers.addCustomerByStaff(db, "f1", "staff-1", staffForm({ name: "Someone else" }))
    expect(again).toEqual({ status: "exists", id: a.id })
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: a.id }, include: { consents: true, addresses: true } })
    expect(c).toMatchObject({ name: "Murugan", source: "walk_in", kind: "hotel", marketingOptIn: true, smsOptIn: false, addedByStaffId: "staff-1", personId: null, phoneVerifiedAt: null })
    expect(c.consents.map((k) => [k.channel, k.given, k.how, k.byStaffId])).toEqual([["whatsapp", true, "in_person", "staff-1"]])
    expect(c.addresses.map((x) => x.line)).toEqual(["12, Bazaar Street"])
    await expect(customers.addCustomerByStaff(db, "f1", "staff-1", staffForm({ phone: "+919000070009", source: "ffy" as never }))).rejects.toThrow("invalid_form")
  })

  it("joins the walk-in to one person when they sign in online, and fills their name in at a second farm", async () => {
    const f1 = await prisma.tenant.findUniqueOrThrow({ where: { id: "f1" } })
    const f2 = await prisma.tenant.findUniqueOrThrow({ where: { id: "f2" } })
    // Signs in at farm 1 with the number staff typed: same record, now proven.
    const one = await customers.registerVerified(f1 as never, { phone: "+919000070001", name: "Ignored", language: "en" })
    const c1 = await prisma.customer.findUniqueOrThrow({ where: { id: one.customerId } })
    expect(c1).toMatchObject({ name: "Murugan", source: "walk_in" })
    expect(c1.personId).toBeTruthy()
    expect(c1.phoneVerifiedAt).toBeInstanceOf(Date)
    expect(await people.knownPerson("+919000070001")).toEqual({ name: "Murugan", language: "ta" })
    // New at farm 2: a separate record (no credit or notes carried over), the same person.
    const two = await customers.registerVerified(f2 as never, { phone: "+919000070001", name: "Murugan", language: "ta", offers: true })
    const c2 = await prisma.customer.findUniqueOrThrow({ where: { id: two.customerId }, include: { consents: true } })
    expect(c2).toMatchObject({ tenantId: "f2", personId: c1.personId, source: "online", marketingOptIn: true, kind: "home" })
    expect(c2.consents.map((k) => [k.channel, k.how])).toEqual([["whatsapp", "shop"]])
    expect(await prisma.platformPerson.count()).toBe(1)
    // Farm 2 can't see farm 1's record.
    expect(await tenantDb("f2").customer.findFirst({ where: { id: one.customerId } })).toBeNull()
  })

  it("logs each change of offers with who and how", async () => {
    const db = tenantDb("f1")
    const c = await db.customer.findFirstOrThrow({ where: { phone: "+919000070001" } })
    await customers.logConsent(db, "f1", c.id, { whatsapp: true, sms: false }, { whatsapp: false, sms: true }, "phone", "staff-2")
    await customers.logConsent(db, "f1", c.id, { whatsapp: false, sms: true }, { whatsapp: false, sms: true }, "phone", "staff-2")
    const rows = await db.customerConsent.findMany({ where: { customerId: c.id }, orderBy: [{ createdAt: "asc" }, { channel: "asc" }] })
    expect(rows.map((k) => [k.channel, k.given, k.how])).toEqual([
      ["whatsapp", true, "in_person"],
      ["sms", true, "phone"],
      ["whatsapp", false, "phone"],
    ])
  })

  it("fills in how old customers came, and moves old offers into the log, safely twice", async () => {
    await pg.exec(`
      INSERT INTO customers (id, "tenantId", phone, name, "marketingOptIn", "optInAt", "updatedAt") VALUES
        ('old-1', 'f1', '+919000080001', 'Old web', true, '2026-01-02', now()),
        ('old-2', 'f1', '+919000080002', 'Old none', false, null, now());
      INSERT INTO orders (id, "tenantId", number, "customerId", channel, "slotDate", "slotLabel", "paymentMethod", "subtotalPaise", "deliveryFeePaise", "totalPaise", "createdAt", "updatedAt") VALUES
        ('o-2', 'f1', 2, 'old-1', 'phone', '2026-01-03', '7–9 AM', 'cash_on_delivery', 100, 0, 100, '2026-01-03', now()),
        ('o-1', 'f1', 1, 'old-1', 'web', '2026-01-02', '7–9 AM', 'cash_on_delivery', 100, 0, 100, '2026-01-02', now());
    `)
    const migration = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-15-customers.sql"), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    const old = await prisma.customer.findMany({ where: { id: { in: ["old-1", "old-2"] } }, orderBy: { id: "asc" }, include: { consents: true } })
    expect(old.map((c) => [c.source, c.kind, c.consents.length])).toEqual([
      ["online", "home", 1],
      [null, "home", 0],
    ])
    expect(old[0].consents[0]).toMatchObject({ channel: "whatsapp", given: true, how: "earlier" })
    // Customers made before keep their sources; the walk-in still says walk-in.
    expect((await prisma.customer.findFirstOrThrow({ where: { tenantId: "f1", phone: "+919000070001" } })).source).toBe("walk_in")
  })
})
