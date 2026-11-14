/**
 * Farms registering themselves, against a real Postgres (PGlite over a local socket): applications are numbered on,
 * one open application per mobile, floods are stopped, the review moves only where it may (with words for the farm
 * when asking for details or turning down), and a farm can be added from it only once the phone and location are
 * checked.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54369
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let apps: typeof import("./applications")
const actor = { kind: "platform_admin" as const, id: "a1", name: "Admin" }

const input = (phone: string, more: Partial<import("./applications").ApplicationInput> = {}) => ({
  ownerName: "Murugan",
  phone,
  email: "Murugan@Example.in",
  nameTa: "முருகன் பண்ணை",
  nameEn: "Murugan Farm",
  modules: ["poultry", "nope"],
  district: "Erode",
  address: "Main road",
  pincode: "638001",
  lat: null,
  lng: null,
  fssai: null,
  gstin: " 33abcde1234f1z5 ",
  pan: null,
  planId: null,
  message: null,
  language: "ta" as const,
  ...more,
})

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  apps = await import("./applications")
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("farm applications", () => {
  it("numbers applications on, keeps one open per mobile, and tidies what was typed", async () => {
    const a = await apps.submitApplication(input("+919000080001"), "src1")
    const b = await apps.submitApplication(input("+919000080002"), "src1")
    expect([a, b]).toEqual([{ number: 1, again: false }, { number: 2, again: false }])
    expect(await apps.submitApplication(input("+919000080001"), "src1")).toEqual({ number: 1, again: true })
    const saved = await prisma.farmApplication.findUniqueOrThrow({ where: { number: 1 } })
    expect(saved).toMatchObject({ email: "murugan@example.in", gstin: "33ABCDE1234F1Z5", modules: ["poultry"], status: "applied" })
    expect(await apps.openApplicationsCount()).toBe(2)
    expect(await prisma.platformEvent.count({ where: { type: "application.received" } })).toBe(2)
  })

  it("refuses wrong details and floods", async () => {
    await expect(apps.submitApplication(input("+919000080003", { fssai: "123" }), null)).rejects.toThrow("application_fssai")
    for (let i = 0; i < 3; i++) await apps.submitApplication(input(`+91900008001${i}`), "src1")
    await expect(apps.submitApplication(input("+919000080020"), "src1")).rejects.toThrow("too_many_tries")
    expect((await apps.submitApplication(input("+919000080020"), "src2")).again).toBe(false)
  })

  it("moves through review, needing words for the farm when asking or turning down", async () => {
    const a = await prisma.farmApplication.findUniqueOrThrow({ where: { number: 2 } })
    await apps.saveReview(a.id, { checklist: { phone: true, junk: true }, notes: " spoke to him " }, actor)
    expect(await prisma.farmApplication.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "reviewing", checklist: { phone: true }, notes: "spoke to him" })
    await expect(apps.moveApplication(a.id, "needs_info", " ", actor)).rejects.toThrow("reply_needed")
    await apps.moveApplication(a.id, "needs_info", "Send your FSSAI photo", actor)
    await expect(apps.moveApplication(a.id, "approved", null, actor)).rejects.toThrow("invalid_form")
    await apps.moveApplication(a.id, "rejected", "Not a farm", actor)
    expect(await prisma.farmApplication.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: "rejected", reply: "Not a farm" })
    await apps.moveApplication(a.id, "reviewing", null, actor)
    expect(await prisma.auditEntry.count({ where: { action: { startsWith: "application." } } })).toBe(4)
  })

  it("lets a farm be added only once the phone and location are checked", async () => {
    const a = await prisma.farmApplication.findUniqueOrThrow({ where: { number: 1 } })
    await expect(apps.applicationToApprove(a.id)).rejects.toThrow("application_not_checked")
    await apps.saveReview(a.id, { checklist: { phone: true, location: true }, notes: null }, actor)
    expect((await apps.applicationToApprove(a.id)).id).toBe(a.id)
    await prisma.tenant.create({ data: { id: "t1", slug: "murugan", nameTa: "முருகன்", nameEn: "Murugan", phone: "+919000080001", invoicePrefix: "MF" } })
    await apps.markApproved(a.id, "t1", actor)
    await expect(apps.applicationToApprove(a.id)).rejects.toThrow("application_closed")
    const d = await apps.applicationDetail(a.id)
    expect(d).toMatchObject({ status: "approved", farm: { id: "t1" }, sameFarmPhone: { id: "t1" } })
    // Approved, the same mobile may apply again (a second farm)
    expect((await apps.submitApplication(input("+919000080001"), "src3")).again).toBe(false)
  })
})
