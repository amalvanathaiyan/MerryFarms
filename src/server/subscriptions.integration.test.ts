/**
 * Plans, subscriptions, module settings and requests against a real Postgres (PGlite over a local socket): the
 * starting plans give exactly what the old levels gave, editing a plan farms are on makes a new version, add-on
 * requests and pausing change what a farm may use, and switching a module off reaches every farm.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { resolveFeatures } from "@/domain/features"

vi.mock("server-only", () => ({}))

const PORT = 54351
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let subs: typeof import("./subscriptions")
let featuresOf: typeof import("@/lib/features").featuresOf

const farm = (id: string, plan: "free" | "starter" | "growth" | "pro") => ({
  id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan, defaultLanguage: "ta" as const,
  phone: "+919000060001", invoicePrefix: "TF", whatsappMode: "lite" as const, deliveryFeePaise: 0, freeAbovePaise: 0,
})
const tenant = (id: string) => prisma.tenant.findUniqueOrThrow({ where: { id } })
const planNamed = (nameEn: string) => prisma.platformPlan.findFirstOrThrow({ where: { nameEn, retired: false } })
const base = { status: "active", billingCycle: "monthly" as const, trialEndsOn: null, addOns: [], moduleOverrides: {}, priceOverridePaise: null, notes: null }

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  subs = await import("./subscriptions")
  ;({ featuresOf } = await import("@/lib/features"))
  await prisma.tenant.createMany({ data: [farm("f1", "free"), farm("f2", "starter"), farm("f3", "growth"), farm("f4", "pro")] })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("plans and subscriptions", () => {
  it("starting plans give every farm exactly what its old level gave", async () => {
    await subs.createStarterPlans()
    await subs.createStarterPlans() // only once
    expect(await prisma.platformPlan.count()).toBe(4)
    for (const [id, name] of [["f1", "Free"], ["f2", "Starter"], ["f3", "Growth"], ["f4", "Pro"]] as const) {
      const before = featuresOf(await tenant(id))
      await subs.setSubscription(id, { ...base, planId: (await planNamed(name)).id })
      const t = await tenant(id)
      expect(t.entitlements).not.toBeNull()
      expect(featuresOf(t)).toEqual(before)
    }
  })

  it("editing a plan farms are on makes a new version; those farms keep the old one", async () => {
    const growth = await planNamed("Growth")
    const input = { nameTa: growth.nameTa, nameEn: "Growth", descriptionTa: null, descriptionEn: null, monthlyPaise: 49_900, yearlyPaise: null, trialDays: 30, modules: growth.modules, features: {}, limits: { products: 5 }, isPublic: true, sortOrder: 2 }
    const r = await subs.updatePlan(growth.id, input)
    expect(r.newVersion).toBe(true)
    const [old, fresh] = await Promise.all([prisma.platformPlan.findUniqueOrThrow({ where: { id: growth.id } }), prisma.platformPlan.findUniqueOrThrow({ where: { id: r.id } })])
    expect(old.retired).toBe(true)
    expect(fresh.version).toBe(2)
    expect((await prisma.farmSubscription.findUniqueOrThrow({ where: { tenantId: "f3" } })).planId).toBe(growth.id)
    // a name-only change of a plan nobody is on edits it in place
    const r2 = await subs.updatePlan(r.id, { ...input, nameTa: "வளர்ச்சி 2" })
    expect(r2).toEqual({ id: r.id, newVersion: false })
  })

  it("an approved add-on request adds the module; a pending duplicate is refused", async () => {
    expect(featuresOf(await tenant("f1")).poultryCare).toBe(false)
    const req = await subs.requestAddOn("f1", null, "poultry", "We keep 200 country hens")
    await expect(subs.requestAddOn("f1", null, "poultry", null)).rejects.toMatchObject({ code: "request_pending" })
    await subs.decideRequest(req.id, true, "Added", "Admin")
    const t = await tenant("f1")
    expect((t.entitlements as { modules: string[] }).modules).toContain("poultry")
    await expect(subs.requestAddOn("f1", null, "poultry", null)).rejects.toMatchObject({ code: "already_have" })
    // the Free plan holds Farm Core and Selling only; Poultry starts from Starter
    expect((await planNamed("Free")).modules).toEqual(["selling"])
    expect((await planNamed("Starter")).modules.sort()).toEqual(["poultry", "selling"])
    // poultryCare is off on the Free plan (its rule), so the module is there but that feature stays off
    expect(resolveFeatures({ planId: null, modules: ["core", "selling", "poultry"], features: {}, limits: {}, status: "active" }, {}).poultryScenes).toBe(false)
  })

  it("a paused farm keeps only Farm Core; switching a module off platform-wide reaches every farm", async () => {
    await subs.setSubscription("f4", { ...base, planId: (await planNamed("Pro")).id, status: "paused" })
    let f = featuresOf(await tenant("f4"))
    expect(f.webShop).toBe(false)
    expect(f.farmRecords).toBe(true)
    await subs.setSubscription("f4", { ...base, planId: (await planNamed("Pro")).id })
    expect(featuresOf(await tenant("f4")).webShop).toBe(true)

    await subs.saveModuleSetting("selling", { enabled: false, addOnMonthlyPaise: null, addOnYearlyPaise: null, addOnTrialDays: 14, requestable: true })
    f = featuresOf(await tenant("f4"))
    expect(f.webShop).toBe(false)
    await subs.saveModuleSetting("selling", { enabled: true, addOnMonthlyPaise: null, addOnYearlyPaise: null, addOnTrialDays: 14, requestable: true })
    expect(featuresOf(await tenant("f4")).webShop).toBe(true)
  })

  it("removing the plan takes a farm back to its old level", async () => {
    await subs.removeSubscription("f2")
    expect((await tenant("f2")).entitlements).toBeNull()
    expect(featuresOf(await tenant("f2")).videoUploads).toBe(true) // starter level
  })
})
