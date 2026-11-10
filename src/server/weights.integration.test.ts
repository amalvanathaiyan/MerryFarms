/**
 * Weekly weights against a real Postgres (PGlite over a local socket): saving, replacing the same day, refusing
 * slips, staying inside the farm, and going with the batch when it is deleted.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54337
const TODAY = "2026-10-20"

let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let weights: typeof import("./weights")
let batchId: string

const tenantRow = (id: string) => ({
  id,
  slug: id,
  nameTa: id,
  nameEn: id,
  status: "active" as const,
  plan: "pro" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000040001",
  invoicePrefix: "MF",
  whatsappMode: "lite" as const,
  deliveryFeePaise: 0,
  freeAbovePaise: 0,
  features: { poultryCare: true },
})

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
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  weights = await import("./weights")
  await prisma.tenant.createMany({ data: [tenantRow("t1"), tenantRow("t2")] })
  const batches = await import("./batches")
  const b = await batches.createBatch(
    "t1",
    "s1",
    { name: "Broilers", breed: null, purpose: "meat", source: "bought", supplier: null, startDate: "2026-10-01", ageAtStartDays: 1, startCount: 100, eggsSet: null, parentBatchId: null, eggValuePaise: null, note: null, chicksCostPaise: null },
    TODAY
  )
  batchId = b.id
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("weekly weights", () => {
  it("saves a weighing, and weighing again the same day replaces it (keeping when it was first made)", async () => {
    const first = await weights.saveWeight("t1", "s1", batchId, { date: "2026-10-08", birds: 10, totalGrams: 1800, note: null }, TODAY)
    const again = await weights.saveWeight("t1", "s2", batchId, { date: "2026-10-08", birds: 12, totalGrams: 2280, note: "after feed" }, TODAY)
    expect(again.id).toBe(first.id)
    expect(again.createdAt.getTime()).toBe(first.createdAt.getTime())
    await weights.saveWeight("t1", "s1", batchId, { date: "2026-10-15", birds: 10, totalGrams: 4600, note: null }, TODAY)
    const rows = await weights.loadWeights("t1", batchId)
    expect(rows.map((r) => [r.date, r.birds, r.totalGrams, r.byStaffId])).toEqual([
      ["2026-10-08", 12, 2280, "s2"],
      ["2026-10-15", 10, 4600, "s1"],
    ])
  })

  it("refuses slips: a day off the farm, a weight that must be kilos typed as grams, an unknown batch", async () => {
    expect(await code(weights.saveWeight("t1", "s1", batchId, { date: "2026-09-30", birds: 10, totalGrams: 1800, note: null }, TODAY))).toBe("weight_date")
    expect(await code(weights.saveWeight("t1", "s1", batchId, { date: "2026-10-16", birds: 10, totalGrams: 46, note: null }, TODAY))).toBe("weight_odd")
    expect(await code(weights.saveWeight("t1", "s1", "nope", { date: "2026-10-16", birds: 10, totalGrams: 4600, note: null }, TODAY))).toBe("batch_not_found")
  })

  it("stays inside the farm: another farm can neither weigh nor delete this batch's weighings", async () => {
    expect(await code(weights.saveWeight("t2", "x", batchId, { date: "2026-10-16", birds: 10, totalGrams: 4600, note: null }, TODAY))).toBe("batch_not_found")
    const [row] = await weights.loadWeights("t1", batchId)
    expect(await code(weights.deleteWeight("t2", row.id))).toBe("weight_not_found")
    expect(await weights.loadWeights("t2", batchId)).toEqual([])
    await weights.deleteWeight("t1", row.id)
    expect((await weights.loadWeights("t1", batchId)).map((r) => r.date)).toEqual(["2026-10-15"])
  })

  it("goes with the batch when the batch is deleted", async () => {
    await tenantDb("t1").batch.deleteMany({ where: { id: batchId } })
    expect(await prisma.batchWeight.count()).toBe(0)
  })
})
