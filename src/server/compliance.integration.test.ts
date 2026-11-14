/**
 * Screening farms' products against the restricted items list, against a real Postgres (PGlite over a local socket):
 * nothing happens while it's switched off; a match hides and holds the product and opens one case; changing the
 * words clears it; licensed farms may list licensed items; and Farm For You's decisions show, keep or remove it.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54371
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let c: typeof import("./compliance")
const actor = { kind: "platform_admin" as const, id: "a1", name: "Admin" }

const farm = (id: string, fssaiNo: string | null = null) => ({ id, slug: id, nameTa: id, nameEn: id, phone: "+919000090001", invoicePrefix: "TF", fssaiNo })
const product = (id: string, tenantId: string, nameEn: string) => ({ id, tenantId, categoryId: `cat-${tenantId}`, nameTa: "பொருள்", nameEn, packTa: "1", packEn: "1", pricePaise: 10_000 })
const p = (id: string) => prisma.product.findUniqueOrThrow({ where: { id } })

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  c = await import("./compliance")
  await prisma.tenant.createMany({ data: [farm("f1"), farm("f2", "12345678901234")] })
  await prisma.category.createMany({ data: [{ id: "cat-f1", tenantId: "f1", nameTa: "வகை", nameEn: "Things" }, { id: "cat-f2", tenantId: "f2", nameTa: "வகை", nameEn: "Things" }] })
  await prisma.product.createMany({ data: [product("peacock", "f1", "Peacock feathers"), product("honey1", "f1", "Hill honey"), product("honey2", "f2", "Hill honey"), product("eggs", "f1", "Country eggs")] })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("screening", () => {
  it("does nothing while switched off", async () => {
    expect(await c.addStarterItems(actor)).toBeGreaterThan(5)
    expect(await c.screenProduct("f1", "peacock")).toBeNull()
    expect((await p("peacock")).isActive).toBe(true)
  })

  it("hides and holds a match, with one case, once on", async () => {
    await c.saveComplianceConfig({ on: true, repeatLimit: 1 }, actor)
    expect(await c.screenProduct("f1", "peacock")).toBe("block")
    expect(await c.screenProduct("f1", "peacock")).toBe("block")
    expect(await p("peacock")).toMatchObject({ isActive: false, complianceHold: "block" })
    expect(await prisma.complianceCase.count({ where: { subjectId: "peacock", status: "open" } })).toBe(1)
    expect(await c.screenProduct("f1", "eggs")).toBeNull()
    expect(await c.openCasesCount()).toBe(1)
    const holds = await c.farmHolds("f1")
    expect(holds.peacock).toMatchObject({ status: "open", action: "block" })
    expect(holds.peacock.reasonEn).toMatch(/Wildlife/)
  })

  it("lets a licensed farm list licensed items", async () => {
    expect(await c.screenProduct("f1", "honey1")).toBe("licence")
    expect(await c.screenProduct("f2", "honey2")).toBeNull()
  })

  it("clears the case when the farm changes the words", async () => {
    await prisma.product.update({ where: { id: "honey1" }, data: { nameEn: "Hill fruit", nameTa: "பழம்" } })
    expect(await c.screenProduct("f1", "honey1")).toBeNull()
    expect(await p("honey1")).toMatchObject({ complianceHold: null })
    expect(await prisma.complianceCase.findFirst({ where: { subjectId: "honey1" } })).toMatchObject({ status: "cleared" })
  })

  it("decides: allowed shows it again and isn't asked twice; kept hidden counts against the farm", async () => {
    const open = (await c.listCases("open"))[0]
    expect(open).toMatchObject({ subjectId: "peacock", farm: { id: "f1" }, item: { labelEn: "Peafowl" } })
    await c.decideCase(open.id, "kept_hidden", "Not allowed", actor)
    expect(await p("peacock")).toMatchObject({ isActive: false, complianceHold: "block" })
    expect((await c.repeatFarms()).map((f) => f.id)).toEqual(["f1"])
    await expect(c.decideCase(open.id, "kept_hidden", null, actor)).rejects.toThrow("case_closed")
    await c.decideCase(open.id, "allowed", "Feathers dropped naturally", actor)
    expect(await p("peacock")).toMatchObject({ isActive: true, complianceHold: null })
    expect(await c.screenProduct("f1", "peacock")).toBeNull()
    expect(await prisma.auditEntry.count({ where: { action: { in: ["compliance.kept_hidden", "compliance.allowed"] } } })).toBe(2)
  })

  it("removes a product, and reports a category without hiding it", async () => {
    await prisma.product.create({ data: product("toddy", "f1", "Fresh toddy") })
    await c.screenProduct("f1", "toddy")
    const t = (await c.listCases("open")).find((x) => x.subjectId === "toddy")!
    await c.decideCase(t.id, "removed", null, actor)
    expect((await p("toddy")).deletedAt).not.toBeNull()
    await prisma.category.update({ where: { id: "cat-f1" }, data: { nameEn: "Turtles" } })
    await c.screenCategory("f1", "cat-f1")
    await c.screenCategory("f1", "cat-f1")
    expect(await prisma.complianceCase.count({ where: { subjectId: "cat-f1", status: "open" } })).toBe(1)
    const cat = (await c.listCases("open")).find((x) => x.subjectId === "cat-f1")!
    await expect(c.decideCase(cat.id, "removed", null, actor)).rejects.toThrow("invalid_form")
  })
})
