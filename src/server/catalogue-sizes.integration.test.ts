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

describe("product kinds", () => {
  it("loads the starter list once, makes a category from a kind, and asks its details for each product", async () => {
    const kinds = await import("./product-kinds")
    const added = await kinds.addStarterKinds()
    expect(added).toBeGreaterThan(10)
    expect(await kinds.addStarterKinds()).toBe(0)
    const milk = (await kinds.listKinds()).find((k) => k.key === "milk")!

    // The farm's milk category, with its own extra detail.
    const own = { key: "breed", ta: "இனம்", en: "Breed", type: "text" as const, choices: [], required: false, shown: true }
    expect(await cat.addCategory({ nameTa: "பால்", nameEn: "Milk", productKindId: milk.id, packs: [{ ta: "5 லி கேன்", en: "5 litre can" }], details: [own] })).toEqual({ ok: true })
    const c = await prisma.category.findFirstOrThrow({ where: { tenantId: "f1", productKindId: milk.id } })
    const p = { categoryId: c.id, nameTa: "பசும் பால்", nameEn: "Cow milk", packTa: "1 லி", packEn: "1 litre", priceRupees: 60, stockQty: 0, stockUnit: "litres", gstRate: 0, isActive: true }
    // "Animal" must be filled in.
    expect(await cat.saveProduct({ ...p, details: { fat: 4 } })).toEqual({ ok: false, error: "details_required" })
    expect(await cat.saveProduct({ ...p, details: { animal: "Cow", fat: 4.2, a2: true, breed: "Kangayam", nonsense: "x" } })).toEqual({ ok: true })
    expect((await prisma.product.findFirstOrThrow({ where: { nameEn: "Cow milk" } })).details).toEqual({ animal: "Cow", fat: 4.2, a2: true, breed: "Kangayam" })

    // A retired kind can't start a new category, but categories made from it keep working.
    await kinds.retireKind(milk.id, true)
    expect(await cat.addCategory({ nameTa: "பால் 2", nameEn: "Milk 2", productKindId: milk.id })).toEqual({ ok: false, error: "not_found" })
    expect(await cat.renameCategory({ id: c.id, nameTa: "பால்", nameEn: "Fresh milk", productKindId: milk.id })).toEqual({ ok: true })
  })

  it("runs the migration safely twice", async () => {
    const migration = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-15-product-kinds.sql"), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    expect(await prisma.productKind.count()).toBeGreaterThan(10)
  })
})
