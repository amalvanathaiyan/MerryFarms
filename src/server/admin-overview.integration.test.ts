/**
 * Admin's dashboard, tech monitor and audit log against a real Postgres (PGlite over a local socket): monthly fees
 * from paying farms only, trials ending this week, the audit log's farm and kind filters with paging, and a tech
 * monitor that reads the database but never shows a key's value.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54365
const NOW = new Date("2026-11-12T06:00:00Z")
const DAY = 86_400_000

let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let overview: typeof import("./admin-overview")
let audit: typeof import("./audit")

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
})

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  overview = await import("./admin-overview")
  audit = await import("./audit")
  await prisma.tenant.createMany({ data: ["paying", "yearly", "trial", "late"].map(tenantRow) })
  const plan = await prisma.platformPlan.create({ data: { family: "poultry", nameTa: "கோழி", nameEn: "Poultry", monthlyPaise: 49_900, yearlyPaise: 499_000, modules: ["poultry"] } })
  await prisma.farmSubscription.createMany({
    data: [
      { tenantId: "paying", planId: plan.id, status: "active" },
      { tenantId: "yearly", planId: plan.id, status: "active", billingCycle: "yearly", priceOverridePaise: 360_000 },
      { tenantId: "trial", planId: plan.id, status: "trial", trialEndsAt: new Date(NOW.getTime() + 3 * DAY) },
      { tenantId: "late", planId: plan.id, status: "trial", trialEndsAt: new Date(NOW.getTime() + 20 * DAY) },
    ],
  })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("admin dashboard", () => {
  it("adds up monthly fees from paying farms only, and lists trials ending within 7 days", async () => {
    const d = await overview.adminDashboard(NOW)
    expect(d.farms.total).toBe(4)
    // 499 a month + 3,600 a year spread over 12 months (300); trials bring nothing
    expect(d.subscriptions.monthlyPaise).toBe(49_900 + 30_000)
    expect(d.subscriptions.byStatus).toMatchObject({ active: 2, trial: 2 })
    expect(d.subscriptions.trialsEnding.map((s) => s.tenantId)).toEqual(["trial"])
    expect(d.automation.tick).toBe("never")
  })
})

describe("audit log", () => {
  it("filters by farm (or Farm For You's own) and kind of change, newest first, a page at a time", async () => {
    const admin = audit.adminActor({ id: "a1", name: "Admin" })
    for (let i = 0; i < 55; i++) await audit.audit(admin, [{ tenantId: "paying", action: "setting.changed", subject: `k${i}` }])
    await audit.audit(admin, [{ tenantId: null, action: "plan.created", subject: "p1" }])
    await audit.audit(admin, [{ tenantId: "trial", action: "farm.changed", subject: "trial" }])

    const first = await overview.auditLog({})
    expect(first.rows).toHaveLength(overview.AUDIT_PAGE)
    expect(first.more).toBe(true)
    expect(first.rows[0].action).toBe("farm.changed")
    const next = await overview.auditLog({ before: first.rows.at(-1)!.createdAt })
    expect(next.rows.length + first.rows.length).toBe(57)
    expect(next.more).toBe(false)

    expect((await overview.auditLog({ farm: "platform" })).rows.map((r) => r.action)).toEqual(["plan.created"])
    expect((await overview.auditLog({ farm: "trial" })).rows.map((r) => r.subject)).toEqual(["trial"])
    expect((await overview.auditLog({ group: "setting" })).rows.every((r) => r.action.startsWith("setting."))).toBe(true)
    expect((await overview.auditLog({ group: "plan" })).rows).toHaveLength(1)
  })
})

describe("tech monitor", () => {
  it("reads the database size and tables, survives no Supabase storage, and never shows a key's value", async () => {
    process.env.CRON_SECRET = "secret-value-123"
    const m = await overview.techMonitor(NOW)
    expect(m.database?.bytes).toBeGreaterThan(0)
    expect(m.tables.some((r) => r.name === "tenants")).toBe(true)
    expect(m.storage).toBeNull()
    expect(m.services.find((s) => s.key === "tick")?.state).toBe("ready")
    expect(JSON.stringify(m)).not.toContain("secret-value-123")
    expect(JSON.stringify(m)).not.toContain("postgres:postgres")
  })
})
