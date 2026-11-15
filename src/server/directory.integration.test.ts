/**
 * Farm For You's farm directory against a real Postgres (PGlite over a local socket): which farms are listed, who
 * delivers to a PIN code or a spot, what they sell, and each farm's page.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
// The PIN code's centre (Nominatim, online): a fixed spot 4 km north of the radius farm.
vi.mock("./geo", () => ({ pincodeCentre: async () => ({ lat: 13.036, lng: 80.0 }) }))

const PORT = 54389
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let dir: typeof import("./directory")

const farm = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  slug: id,
  nameTa: `${id} பண்ணை`,
  nameEn: `${id} Farm`,
  status: "active" as const,
  plan: "pro" as const,
  phone: "+919000090001",
  invoicePrefix: id.toUpperCase().slice(0, 3),
  ...over,
})

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  dir = await import("./directory")
  await prisma.tenant.createMany({
    data: [
      // Delivers within 10 km of the farm.
      farm("radius", { farmLat: 13.0, farmLng: 80.0, deliveryRadiusKm: 10, storyEn: "Hens on open ground.", storyTa: "திறந்த வெளியில் கோழிகள்." }),
      // Delivers to two PIN codes.
      farm("pins", { servedPincodes: ["600001", "600002"] }),
      // No area set: customers ask.
      farm("noarea"),
      farm("hidden"),
      farm("closed", { status: "suspended" as const }),
      farm("noshop", { features: { webShop: false } }),
    ],
  })
  for (const t of ["radius", "pins", "noarea", "hidden", "closed", "noshop"]) {
    await prisma.category.create({ data: { id: `${t}-c`, tenantId: t, nameTa: "முட்டை", nameEn: "Eggs" } })
    await prisma.product.create({
      data: { tenantId: t, categoryId: `${t}-c`, nameTa: "நாட்டுக் கோழி முட்டை", nameEn: "Country eggs", packTa: "6", packEn: "6 eggs", pricePaise: 9_000, stockQty: 10 },
    })
  }
  await prisma.category.create({ data: { id: "pins-m", tenantId: "pins", nameTa: "பால்", nameEn: "Milk" } })
  await prisma.product.create({ data: { tenantId: "pins", categoryId: "pins-m", nameTa: "பசும் பால்", nameEn: "Cow milk", packTa: "1 லி", packEn: "1 litre", pricePaise: 6_000, stockQty: 10 } })
  // A product the farm took off its shop, and one held by compliance (hidden), never show.
  await prisma.product.create({ data: { tenantId: "pins", categoryId: "pins-m", nameTa: "தயிர்", nameEn: "Curd", packTa: "½", packEn: "500 g", pricePaise: 5_000, onWeb: false } })
  await prisma.product.create({ data: { tenantId: "pins", categoryId: "pins-m", nameTa: "X", nameEn: "Banned thing", packTa: "1", packEn: "1", pricePaise: 5_000, isActive: false, complianceHold: "block" } })
  // "hidden" turned off "Show my farm on Farm For You".
  await prisma.settingValue.create({ data: { scopeKey: "farm:hidden", tenantId: "hidden", key: "listedOnFfy", value: false } })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("farm directory", () => {
  it("lists farms whose shop is open and who chose to be shown", async () => {
    const { searched, results } = await dir.searchDirectory({})
    expect(searched).toBe(false)
    expect(results.map((r) => r.slug).sort()).toEqual(["noarea", "pins", "radius"])
    expect((await dir.listedFarmCards()).map((f) => f.slug)).toEqual(["radius", "pins", "noarea"])
  })

  it("puts farms that deliver to a PIN code first, then those to ask, and leaves out the rest", async () => {
    // 600001: the radius farm is ~4 km from its centre (a known distance comes first); the PIN farm serves it; the
    // no-area farm is to ask.
    const r = await dir.searchDirectory({ pincode: "600001" })
    expect(r.results.map((x) => [x.slug, x.reach.reach])).toEqual([
      ["radius", "delivers"],
      ["pins", "delivers"],
      ["noarea", "ask"],
    ])
    expect(r.results[0].reach).toMatchObject({ approx: true, distanceKm: 4 })
    // 600099: not on the PIN farm's list, so it's left out.
    expect((await dir.searchDirectory({ pincode: "600099" })).results.map((x) => x.slug)).toEqual(["radius", "noarea"])
    // A spot 30 km away: the radius farm doesn't reach it; a farm serving PIN codes can't tell from a spot alone.
    expect((await dir.searchDirectory({ location: { lat: 13.27, lng: 80.0 } })).results.map((x) => [x.slug, x.reach.reach])).toEqual([
      ["noarea", "ask"],
      ["pins", "ask"],
    ])
  })

  it("keeps only farms with what the customer wants, and shows those products", async () => {
    const r = await dir.searchDirectory({ pincode: "600001", q: "milk" })
    expect(r.results.map((x) => x.slug)).toEqual(["pins"])
    expect(r.results[0].products.map((p) => p.nameEn)).toEqual(["Cow milk"])
    expect((await dir.searchDirectory({ q: "முட்டை" })).results).toHaveLength(3)
  })

  it("shows a listed farm's page with its story, products and area; none for a farm that isn't listed", async () => {
    const p = await dir.farmProfile("radius")
    expect(p).toMatchObject({ storyEn: "Hens on open ground.", area: { radiusKm: 10, pincodes: [] } })
    expect(p!.products.map((x) => x.nameEn)).toEqual(["Country eggs"])
    expect((await dir.farmProfile("pins"))!.products.map((x) => x.nameEn)).toEqual(["Country eggs", "Cow milk"])
    for (const slug of ["hidden", "closed", "noshop", "nobody"]) expect(await dir.farmProfile(slug)).toBeNull()
  })

  it("runs the migration safely twice", async () => {
    const migration = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-15-farm-story.sql"), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    expect((await prisma.tenant.findUniqueOrThrow({ where: { id: "radius" } })).storyTa).toBe("திறந்த வெளியில் கோழிகள்.")
  })
})
