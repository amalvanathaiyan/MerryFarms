/**
 * The automation engine against a real Postgres (PGlite over a local socket): each recipe alerts once, the farm's own
 * hours and switches are followed, the platform's off switch reaches every farm, failing jobs are retried then marked
 * failed, and every tick is recorded. Notifications are caught instead of sent.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const sent: { tenantId: string; title: string; roles?: string[] }[] = []
vi.mock("./notify", () => ({
  notifyStaff: async (tenantId: string, note: { title: string }, roles?: string[]) => void sent.push({ tenantId, title: note.title, roles }),
}))

const PORT = 54361
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let engine: typeof import("./automation")

const farm = (id: string) => ({
  id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan: "pro" as const, defaultLanguage: "en" as const,
  phone: "+919000070001", invoicePrefix: id.toUpperCase(), whatsappMode: "lite" as const, deliveryFeePaise: 0, freeAbovePaise: 0,
})
const NOW = new Date("2026-11-12T10:00:00Z")
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000)

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  engine = await import("./automation")
  await prisma.tenant.createMany({ data: [farm("a1"), farm("b2")] })
  for (const t of ["a1", "b2"]) {
    await prisma.category.create({ data: { id: `${t}-cat`, tenantId: t, nameTa: "முட்டை", nameEn: "Eggs" } })
    await prisma.deliverySlot.create({ data: { id: `${t}-slot`, tenantId: t, nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 9 } })
    await prisma.customer.create({ data: { id: `${t}-c`, tenantId: t, phone: "+919000070099", name: "Priya" } })
  }
  // a1: one order waiting 5 h (red), one 3 h (yellow); a product low on stock
  const order = (id: string, tenantId: string, number: number, at: Date) =>
    prisma.order.create({ data: { id, tenantId, number, customerId: `${tenantId}-c`, slotId: `${tenantId}-slot`, slotDate: "2026-11-13", slotLabel: "7–9", channel: "web", paymentMethod: "cash_on_delivery", subtotalPaise: 100, deliveryFeePaise: 0, totalPaise: 100, createdAt: at } })
  await order("o-red", "a1", 1, hoursAgo(5))
  await order("o-yellow", "a1", 2, hoursAgo(3))
  await order("o-b", "b2", 1, hoursAgo(5))
  await prisma.product.create({ data: { id: "p-low", tenantId: "a1", categoryId: "a1-cat", nameTa: "முட்டை", nameEn: "Country eggs", packTa: "10", packEn: "Pack of 10", pricePaise: 10_000, stockQty: 3 } })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

beforeEach(() => void (sent.length = 0))

describe("the automation engine", () => {
  it("alerts once for an order past the red mark and once a day for low stock; records the tick", async () => {
    const s = await engine.tick(NOW)
    expect(s).toMatchObject({ farms: 2, ordersWaiting: 2, lowStock: 1, errors: 0 }) // a1's red order and b2's
    expect(sent.filter((x) => x.tenantId === "a1").map((x) => x.title).join(" | ")).toMatch(/1 order waiting.*\| .*1 product low/)
    expect(sent.find((x) => x.title.includes("product low"))?.roles).toEqual(["owner", "packing"])
    // the next tick sends nothing new
    sent.length = 0
    expect(await engine.tick(new Date(NOW.getTime() + 10 * 60_000))).toMatchObject({ ordersWaiting: 0, lowStock: 0 })
    expect(sent).toHaveLength(0)
    expect(await prisma.job.count({ where: { type: "tick", status: "done" } })).toBe(2)
  })

  it("follows the farm's own hours, and the farm switching a recipe off", async () => {
    await engine.saveRecipeSetting("a1", "orderWaiting", true, { yellowHours: 1, redHours: 2.5 })
    expect((await engine.tick(NOW)).ordersWaiting).toBe(1) // the 3-hour order is now red too
    await engine.saveRecipeSetting("b2", "lowStock", false, {})
    await prisma.product.create({ data: { id: "p-b", tenantId: "b2", categoryId: "b2-cat", nameTa: "பால்", nameEn: "Milk", packTa: "1", packEn: "1 litre", pricePaise: 6000, stockQty: 0 } })
    sent.length = 0
    await engine.tick(NOW)
    expect(sent.some((x) => x.tenantId === "b2" && x.title.includes("low"))).toBe(false)
  })

  it("the platform's off switch reaches every farm", async () => {
    await prisma.order.create({ data: { id: "o-late2", tenantId: "a1", number: 3, customerId: "a1-c", slotId: "a1-slot", slotDate: "2026-11-13", slotLabel: "7–9", channel: "web", paymentMethod: "cash_on_delivery", subtotalPaise: 100, deliveryFeePaise: 0, totalPaise: 100, createdAt: hoursAgo(9) } })
    await engine.saveRecipeSetting(null, "orderWaiting", false, {})
    expect((await engine.tick(NOW)).ordersWaiting).toBe(0)
    await engine.saveRecipeSetting(null, "orderWaiting", true, {})
    expect((await engine.tick(NOW)).ordersWaiting).toBe(1)
  })

  it("reminds an owner once before the trial ends", async () => {
    const plan = await prisma.platformPlan.create({ data: { family: "t", nameTa: "t", nameEn: "T", modules: ["selling"] } })
    await prisma.farmSubscription.create({ data: { tenantId: "a1", planId: plan.id, status: "trial", trialEndsAt: new Date(NOW.getTime() + 2 * 86_400_000) } })
    expect((await engine.tick(NOW)).trialEnding).toBe(1)
    expect(sent.find((x) => x.title.includes("Trial ends"))?.roles).toEqual(["owner"])
    expect((await engine.tick(NOW)).trialEnding).toBe(0)
  })

  it("retries a failing job, then marks it failed; events are recorded", async () => {
    const job = await engine.enqueue("no-such-job", "a1", {}, NOW)
    for (let i = 0; i < 6; i++) await engine.tick(new Date(NOW.getTime() + i * 3_600_000))
    const j = await prisma.job.findUniqueOrThrow({ where: { id: job.id } })
    expect(j.status).toBe("failed")
    expect(j.attempts).toBe(5)
    expect(j.lastError).toContain("no handler")
    expect(await prisma.platformEvent.count({ where: { type: "automation.changed" } })).toBeGreaterThan(0)
  })
})
