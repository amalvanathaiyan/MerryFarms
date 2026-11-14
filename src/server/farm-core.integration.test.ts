/**
 * Farm Core's places and machines against a real Postgres (PGlite over a local socket): a place keeps only the
 * details its kind has, a plot sits only in the same farm's land, retiring land retires its plots, and repairs on a
 * machine move its last service and become spending on it.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54373
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let core: typeof import("./farm-core")
let tenantDb: typeof import("@/lib/tenant-db").tenantDb

const place = (kind: string, name: string, more: Partial<import("./farm-core").PlaceInput> = {}) => ({ kind, name, parentId: null, area: null, areaUnit: "acre", surveyNo: null, soil: null, depthFt: null, notes: null, ...more })

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  core = await import("./farm-core")
  await prisma.tenant.createMany({ data: ["f1", "f2"].map((id) => ({ id, slug: id, nameTa: id, nameEn: id, phone: "+919000090001", invoicePrefix: "TF" })) })
  await prisma.staffMember.create({ data: { id: "s1", tenantId: "f1", authUserId: "u1", staffCode: "F1-1", name: "Owner", roles: ["owner"] } })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("places", () => {
  it("keeps only what each kind has, and plots only in the farm's own land", async () => {
    const db = tenantDb("f1")
    const land = await core.savePlace(db, "f1", null, place("block", " East land ", { area: 5, surveyNo: "123/4", soil: "red", depthFt: 40 }))
    const shed = await core.savePlace(db, "f1", null, place("shed", "Hen shed", { area: 2, soil: "red" }))
    const plot = await core.savePlace(db, "f1", null, place("plot", "Coconut", { parentId: land, area: 50, areaUnit: "cent" }))
    expect(await prisma.farmPlace.findUniqueOrThrow({ where: { id: land } })).toMatchObject({ name: "East land", area: 5, surveyNo: "123/4", soil: "red", depthFt: null, sortOrder: 0 })
    expect(await prisma.farmPlace.findUniqueOrThrow({ where: { id: shed } })).toMatchObject({ area: null, soil: null, sortOrder: 1 })
    expect((await prisma.farmPlace.findUniqueOrThrow({ where: { id: plot } })).parentId).toBe(land)
    // Another farm can't put a plot in this farm's land, or change its places
    await expect(core.savePlace(tenantDb("f2"), "f2", null, place("plot", "X", { parentId: land }))).rejects.toThrow("not_found")
    await expect(core.savePlace(tenantDb("f2"), "f2", shed, place("shed", "Mine"))).rejects.toThrow("not_found")
    await core.setPlaceRetired(db, land, true)
    expect((await prisma.farmPlace.findUniqueOrThrow({ where: { id: plot } })).retiredAt).not.toBeNull()
  })
})

describe("machines", () => {
  it("logs repairs and services as spending on the machine", async () => {
    const db = tenantDb("f1")
    const motor = await core.saveAsset(db, "f1", null, { kind: "motor", name: "5 HP motor", placeId: null, boughtOn: "2025-01-01", costPaise: 2_500_000, serviceEveryDays: 180, lastServiceOn: "2026-05-01", notes: null })
    await core.logAssetWork(db, "f1", motor, { date: "2026-11-01", service: true, amountPaise: 150_000, note: "Rewinding", byStaffId: "s1" })
    // An older service doesn't move the last service back
    await core.logAssetWork(db, "f1", motor, { date: "2026-10-01", service: true, amountPaise: null, note: null, byStaffId: "s1" })
    expect((await prisma.farmAsset.findUniqueOrThrow({ where: { id: motor } })).lastServiceOn).toBe("2026-11-01")
    const spend = await core.farmCoreSpending(db, "2026-11-14")
    expect(spend.byAsset[motor]).toBe(150_000)
    expect(spend.latest[motor][0]).toMatchObject({ kind: "repairs", note: "Rewinding" })
    await expect(core.logAssetWork(tenantDb("f2"), "f2", motor, { date: "2026-11-01", service: false, amountPaise: 100, note: null, byStaffId: "s1" })).rejects.toThrow("not_found")
    await expect(core.saveAsset(db, "f1", null, { kind: "rocket", name: "x", placeId: null, boughtOn: null, costPaise: null, serviceEveryDays: null, lastServiceOn: null, notes: null })).rejects.toThrow("invalid_form")
  })
})
