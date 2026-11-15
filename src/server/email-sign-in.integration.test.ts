/**
 * Email codes against a real Postgres (PGlite over a local socket): codes go to the email (through the mail sender),
 * are kept apart from phone codes, and an email code never opens a number the farm already knows; an email sign-up
 * keeps its phone unchecked; a customer with a proven phone can add an email for signing in.
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/server/support", () => ({ noteSupportWrite: async () => {} }))

const PORT = 54387
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let tenantDb: typeof import("@/lib/tenant-db").tenantDb
let otp: typeof import("./otp")
let customers: typeof import("./customers")
let mail: typeof import("./email")

const t0 = new Date("2026-11-15T06:00:00Z")
const at = (s: number) => new Date(t0.getTime() + s * 1000)
const farm = (id: string) => ({ id, slug: id, nameTa: `${id} பண்ணை`, nameEn: `${id} Farm`, status: "active" as const, plan: "pro" as const, phone: "+919000090001", invoicePrefix: "TF" })
const sent: { to: string; subject: string; text: string }[] = []
const codeIn = (text: string) => /\b(\d{6})\b/.exec(text)![1]

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  ;({ tenantDb } = await import("@/lib/tenant-db"))
  otp = await import("./otp")
  customers = await import("./customers")
  mail = await import("./email")
  mail.setEmailSenderForTests(async (m) => void sent.push(m))
  otp.sendEmailCodesInTests(true)
  await prisma.tenant.createMany({ data: ["f1", "f2"].map(farm) })
}, 60_000)

afterAll(async () => {
  mail?.setEmailSenderForTests(null)
  otp?.sendEmailCodesInTests(false)
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

describe("email codes", () => {
  const PHONE = "+919000070001"
  const EMAIL = "kavi@example.com"

  it("emails a code that works once, for that phone and email only, and never as a phone code", async () => {
    const f1 = (await prisma.tenant.findUniqueOrThrow({ where: { id: "f1" } })) as never
    expect(await otp.requestEmailCode(f1, PHONE, EMAIL, t0)).toEqual({ ok: true })
    expect(sent.at(-1)).toMatchObject({ to: EMAIL })
    expect(sent.at(-1)!.subject).toContain("f1 Farm")
    const code = codeIn(sent.at(-1)!.text)
    expect(await otp.requestEmailCode(f1, PHONE, EMAIL, at(10))).toEqual({ ok: false, error: "otp_wait", seconds: 20 })
    expect(await otp.verifyCode("f1", PHONE, code, at(20))).toBe("no_code")
    expect(await otp.verifyEmailCode("f1", PHONE, "other@example.com", code, at(20))).toBe("no_code")
    expect(await otp.verifyEmailCode("f2", PHONE, EMAIL, code, at(20))).toBe("no_code")
    expect(await otp.verifyEmailCode("f1", PHONE, EMAIL, code, at(21))).toBe("ok")
    expect(await otp.verifyEmailCode("f1", PHONE, EMAIL, code, at(22))).toBe("no_code")
  })

  it("signs up a new number by email with the phone unchecked and no person link; the email then signs it in", async () => {
    const f1 = (await prisma.tenant.findUniqueOrThrow({ where: { id: "f1" } })) as never
    expect((await customers.emailSignIn("f1", PHONE, EMAIL)).case).toBe("new")
    const { customerId } = await customers.registerVerified(f1, { phone: PHONE, name: "Kavi", language: "ta", email: EMAIL })
    const c = await tenantDb("f1").customer.findFirstOrThrow({ where: { id: customerId } })
    expect(c).toMatchObject({ email: EMAIL, phoneVerifiedAt: null, personId: null })
    expect(c.emailVerifiedAt).not.toBeNull()
    expect(await prisma.platformPerson.count({ where: { phone: PHONE } })).toBe(0)
    expect(await customers.emailSignIn("f1", PHONE, EMAIL)).toEqual({ case: "known", customerId })
    // The same email for another number at this farm: no.
    expect((await customers.emailSignIn("f1", "+919000070002", EMAIL)).case).toBe("email_in_use")
    // Another farm doesn't know this number: a sign-up of its own there.
    expect((await customers.emailSignIn("f2", PHONE, EMAIL)).case).toBe("new")
  })

  it("never opens a number the farm already knows without that email", async () => {
    const f1 = (await prisma.tenant.findUniqueOrThrow({ where: { id: "f1" } })) as never
    await tenantDb("f1").customer.create({ data: { tenantId: "f1", phone: "+919000070003", name: "Ravi" } })
    expect((await customers.emailSignIn("f1", "+919000070003", "ravi@example.com")).case).toBe("phone_known")
    await expect(customers.registerVerified(f1, { phone: "+919000070003", name: "X", language: "ta", email: "x@example.com" })).rejects.toThrow("email_phone_known")
    expect((await tenantDb("f1").customer.findFirstOrThrow({ where: { phone: "+919000070003" } })).email).toBeNull()
  })

  it("adds an email only for a customer whose phone is proven, and not one another customer uses", async () => {
    const db = tenantDb("f1")
    const ravi = await db.customer.findFirstOrThrow({ where: { phone: "+919000070003" } })
    await expect(customers.linkEmail("f1", ravi.id, "ravi@example.com")).rejects.toThrow("phone_not_proven")
    await db.customer.updateMany({ where: { id: ravi.id }, data: { phoneVerifiedAt: t0 } })
    await expect(customers.linkEmail("f1", ravi.id, EMAIL)).rejects.toThrow("email_in_use")
    await customers.linkEmail("f1", ravi.id, "ravi@example.com")
    expect(await customers.emailSignIn("f1", "+919000070003", "ravi@example.com")).toEqual({ case: "known", customerId: ravi.id })
    await customers.unlinkEmail("f1", ravi.id)
    expect((await customers.emailSignIn("f1", "+919000070003", "ravi@example.com")).case).toBe("phone_known")
  })

  it("keeps the 'email proven' note to its farm, phone and email, for a short time", () => {
    const note = otp.signEmailVerified("f1", PHONE, EMAIL, t0)
    expect(otp.readEmailVerified("f1", note, at(60))).toEqual({ phone: PHONE, email: EMAIL })
    expect(otp.readEmailVerified("f2", note, at(60))).toBeNull()
    expect(otp.readEmailVerified("f1", note, at(21 * 60))).toBeNull()
    // A phone note is not an email note, and the other way round.
    expect(otp.readEmailVerified("f1", otp.signVerified("f1", PHONE, t0), at(60))).toBeNull()
    expect(otp.readVerified("f1", note, at(60))).toBeNull()
  })

  it("runs the migration safely twice", async () => {
    const migration = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-15-email-sign-in.sql"), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    expect(await prisma.customer.count({ where: { email: { not: null } } })).toBe(1)
  })
})
