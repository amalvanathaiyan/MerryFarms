/**
 * Farm For You's invoices, payments, GST switch and announcements against a real Postgres (PGlite over a local
 * socket): invoices number on in the financial year and keep the details they were made with, GST is added only
 * when switched on, payments mark an invoice paid (and taking one back makes it due again), a paid-on invoice can't
 * be cancelled, and announcements reach only the farms and people chosen.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54367
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let billing: typeof import("./platform-billing")
const actor = { kind: "platform_admin" as const, id: "a1", name: "Admin" }
const TN = "33ABCDE1234F1Z5"
const now = new Date("2026-11-14T10:00:00+05:30")

const farm = (id: string, gstin: string | null = null) => ({
  id, slug: id, nameTa: id, nameEn: id, status: "active" as const, plan: "free" as const, defaultLanguage: "ta" as const,
  phone: "+919000070001", invoicePrefix: "TF", whatsappMode: "lite" as const, deliveryFeePaise: 0, freeAbovePaise: 0, gstin,
})
const input = (tenantId: string, amountPaise = 50_000) => ({ tenantId, lines: [{ text: "Plan", amountPaise }], periodStart: "2026-11-15", periodEnd: "2026-12-14", dueOn: null, otherState: false, notes: null })
const profile = { name: "Farm For You", address: "", phone: "", email: "", upiId: "ffy@upi", bank: "", dueDays: 7, gstin: TN, gstRatePct: 18, sac: "998314" }

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  billing = await import("./platform-billing")
  await prisma.tenant.createMany({ data: [farm("f1"), farm("f2", "29ABCDE1234F1Z5")] })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("platform billing", () => {
  it("numbers invoices on, with no GST while it is off", async () => {
    const a = await billing.createInvoice(input("f1"), actor, now)
    const b = await billing.createInvoice(input("f2"), actor, now)
    expect([a.number, b.number]).toEqual(["FFY/26-27/0001", "FFY/26-27/0002"])
    expect(a).toMatchObject({ gstKind: "none", gstPaise: 0, totalPaise: 50_000, issuedOn: "2026-11-14", dueOn: "2026-11-21", status: "due" })
    expect(await prisma.auditEntry.count({ where: { action: "billing.invoice_made" } })).toBe(2)
  })

  it("won't switch GST on without a GSTIN, and adds it once on", async () => {
    await expect(billing.saveBillingProfile({ ...profile, gstOn: true, gstin: "" }, actor)).rejects.toThrow("gstin_needed")
    await billing.saveBillingProfile({ ...profile, gstOn: true }, actor)
    expect((await billing.billingProfile()).gstOn).toBe(true)
    const same = await billing.createInvoice(input("f1", 10_000), actor, now)
    const other = await billing.createInvoice(input("f2", 10_000), actor, now)
    expect(same).toMatchObject({ gstKind: "cgst_sgst", gstPaise: 1_800, totalPaise: 11_800 })
    expect(other).toMatchObject({ gstKind: "igst", gstPaise: 1_800 })
    expect((same.seller as { gstin: string }).gstin).toBe(TN)
    expect(await prisma.auditEntry.count({ where: { action: "billing.gst_switched" } })).toBe(1)
    await billing.saveBillingProfile({ ...profile, gstOn: false }, actor)
  })

  it("marks an invoice paid when payments reach its total, and due again if one is taken back", async () => {
    const inv = await billing.createInvoice(input("f1", 30_000), actor, now)
    await billing.recordPayment({ invoiceId: inv.id, amountPaise: 10_000, method: "upi", reference: "UTR1", paidOn: "2026-11-14" }, actor)
    expect((await billing.invoiceWithPayments(inv.id))!.status).toBe("due")
    await expect(billing.recordPayment({ invoiceId: inv.id, amountPaise: 30_000, method: "upi", reference: null, paidOn: "2026-11-14" }, actor)).rejects.toThrow("payment_too_much")
    await billing.recordPayment({ invoiceId: inv.id, amountPaise: 20_000, method: "bank", reference: null, paidOn: "2026-11-15" }, actor)
    const paid = (await billing.invoiceWithPayments(inv.id))!
    expect(paid).toMatchObject({ status: "paid", paidPaise: 30_000, leftPaise: 0 })
    await expect(billing.voidInvoice(inv.id, "mistake", actor)).rejects.toThrow("invoice_has_payments")
    await billing.removePayment(paid.payments[1].id, actor)
    expect((await billing.invoiceWithPayments(inv.id))!).toMatchObject({ status: "due", leftPaise: 20_000 })
    // A farm only ever sees its own
    expect(await billing.invoiceWithPayments(inv.id, "f2")).toBeNull()
  })

  it("cancels an unpaid invoice, which then owes nothing; the next period follows the last one billed", async () => {
    const inv = await billing.createInvoice(input("f2"), actor, now)
    await billing.voidInvoice(inv.id, "wrong amount", actor)
    const f2 = await billing.farmInvoices("f2")
    expect(f2.invoices.find((i) => i.id === inv.id)).toMatchObject({ status: "void", leftPaise: 0 })
    expect((await billing.invoiceDraftInputs("f1", now)).periodStart).toBe("2026-12-15")
    expect(await billing.overdueCount(new Date("2026-11-30T10:00:00+05:30"))).toBeGreaterThan(0)
  })

  it("shows announcements to the chosen farms and people, between their dates", async () => {
    const all = await billing.saveAnnouncement(null, { titleTa: "அ", titleEn: "All", bodyTa: null, bodyEn: null, tone: "info", audience: "everyone", onlyFarms: [], startsOn: "2026-11-01", endsOn: null }, actor)
    await billing.saveAnnouncement(null, { titleTa: "ஆ", titleEn: "Owners of f2", bodyTa: null, bodyEn: null, tone: "important", audience: "owners", onlyFarms: ["f2"], startsOn: "2026-11-01", endsOn: "2026-11-30" }, actor)
    await billing.saveAnnouncement(null, { titleTa: "இ", titleEn: "Later", bodyTa: null, bodyEn: null, tone: "info", audience: "everyone", onlyFarms: [], startsOn: "2026-12-01", endsOn: null }, actor)
    await expect(billing.saveAnnouncement(null, { titleTa: "x", titleEn: "x", bodyTa: null, bodyEn: null, tone: "info", audience: "everyone", onlyFarms: [], startsOn: "2026-12-01", endsOn: "2026-11-01" }, actor)).rejects.toThrow("ends_before_start")
    const titles = async (t: string, owner: boolean) => (await billing.announcementsFor(t, owner, now)).map((a) => a.titleEn)
    expect(await titles("f1", true)).toEqual(["All"])
    expect(await titles("f2", true)).toEqual(["Owners of f2", "All"])
    expect(await titles("f2", false)).toEqual(["All"])
    await billing.endAnnouncement(all.id, actor, now)
    expect(await titles("f1", true)).toEqual([])
  })
})
