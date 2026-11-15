/**
 * Sizes of one product (src/domain/sizes.ts) through the catalogue's own actions, against a real Postgres (PGlite
 * over a local socket): a new size joins its product, renaming or moving one size takes the others along, and moving
 * a product moves all its sizes past the next product.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))
vi.mock("@/server/compliance", () => ({ screenSafely: async () => {}, screenProduct: async () => {}, screenCategory: async () => {} }))
vi.mock("@/lib/auth", async () => {
  const { tenantDb } = await import("@/lib/tenant-db")
  const { prisma } = await import("@/lib/prisma")
  return {
    OWNER_ONLY: ["owner"],
    requireStaff: async () => ({ db: tenantDb("f1"), tenant: await prisma.tenant.findUniqueOrThrow({ where: { id: "f1" } }), staff: { id: "owner", roles: ["owner"] } }),
  }
})

const PORT = 54391
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let cat: typeof import("@/app/actions/catalogue")

const form = (over: Record<string, unknown>) => ({
  categoryId: "eggs",
  nameTa: "நாட்டுக் கோழி முட்டை",
  nameEn: "Country eggs",
  packTa: "6 முட்டை",
  packEn: "6 eggs",
  priceRupees: 90,
  stockQty: 10,
  stockUnit: "packs",
  gstRate: 0,
  isActive: true,
  ...over,
})
const names = async () =>
  (await prisma.product.findMany({ where: { tenantId: "f1", deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })).map((p) => `${p.categoryId}:${p.nameEn}:${p.packEn}`)

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  cat = await import("@/app/actions/catalogue")
  await prisma.tenant.create({ data: { id: "f1", slug: "f1", nameTa: "f1", nameEn: "f1", status: "active", plan: "pro", phone: "+919000090001", invoicePrefix: "TF" } })
  await prisma.category.createMany({
    data: [
      { id: "eggs", tenantId: "f1", nameTa: "முட்டை", nameEn: "Eggs" },
      { id: "farm", tenantId: "f1", nameTa: "பண்ணை", nameEn: "Farm" },
    ],
  })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("sizes in the catalogue", () => {
  it("keeps a product's sizes together through new sizes, renames, moves between categories and reordering", async () => {
    expect(await cat.saveProduct(form({}))).toEqual({ ok: true })
    expect(await cat.saveProduct(form({ nameTa: "வாத்து முட்டை", nameEn: "Duck eggs", priceRupees: 120 }))).toEqual({ ok: true })
    // A size of country eggs: same names, its own pack and price.
    expect(await cat.saveProduct(form({ packTa: "30 முட்டை", packEn: "Tray of 30", priceRupees: 390 }))).toEqual({ ok: true })
    expect(await names()).toEqual(["eggs:Country eggs:6 eggs", "eggs:Duck eggs:6 eggs", "eggs:Country eggs:Tray of 30"])

    // Moving country eggs down takes both its sizes past duck eggs.
    const six = await prisma.product.findFirstOrThrow({ where: { packEn: "6 eggs", nameEn: "Country eggs" } })
    expect(await cat.moveProduct(six.id, "down")).toEqual({ ok: true })
    expect(await names()).toEqual(["eggs:Duck eggs:6 eggs", "eggs:Country eggs:6 eggs", "eggs:Country eggs:Tray of 30"])

    // Renaming one size (and moving it to another category) brings its other size along; duck eggs stay.
    expect(await cat.saveProduct(form({ id: six.id, categoryId: "farm", nameEn: "Naatu kozhi eggs" }))).toEqual({ ok: true })
    expect((await names()).sort()).toEqual(["eggs:Duck eggs:6 eggs", "farm:Naatu kozhi eggs:6 eggs", "farm:Naatu kozhi eggs:Tray of 30"])
    // Prices and packs stay each size's own.
    const tray = await prisma.product.findFirstOrThrow({ where: { packEn: "Tray of 30" } })
    expect(tray.pricePaise).toBe(39_000)
  })
})
