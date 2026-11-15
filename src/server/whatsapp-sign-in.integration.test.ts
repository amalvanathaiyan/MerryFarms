/**
 * Free sign-in against a real Postgres (PGlite over a local socket): the customer sends the code from their own
 * WhatsApp, the webhook proves the request, and only the browser that started it is signed in, once.
 */
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54385
let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let wa: typeof import("./whatsapp-sign-in")
let cloud: typeof import("./whatsapp-cloud")

const t0 = new Date("2026-11-15T06:00:00Z")
const at = (s: number) => new Date(t0.getTime() + s * 1000)
const PHONE = "+919000080001"
const replies: { to: string; body: string }[] = []

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  process.env.WHATSAPP_NUMBER = "919999900000"
  ;({ prisma } = await import("@/lib/prisma"))
  wa = await import("./whatsapp-sign-in")
  cloud = await import("./whatsapp-cloud")
  cloud.setWhatsAppTextSenderForTests(async (to, body) => void replies.push({ to, body }))
  await prisma.tenant.createMany({
    data: ["f1", "f2"].map((id) => ({ id, slug: id, nameTa: `${id} பண்ணை`, nameEn: `${id} Farm`, status: "active" as const, plan: "pro" as const, phone: "+919000090001", invoicePrefix: "TF" })),
  })
}, 60_000)

afterAll(async () => {
  cloud?.setWhatsAppTextSenderForTests(null)
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
})

const start = async (tenantId: string, s: number) => {
  const r = await wa.startSignIn({ id: tenantId }, PHONE, "ta", at(s))
  if (!r.ok) throw new Error(r.error)
  return r
}

describe("customer sends the code on WhatsApp", () => {
  it("proves the number when the code comes from that number, and signs in only the browser that asked, once", async () => {
    const r = await start("f1", 0)
    expect(r.link).toBe(`https://wa.me/919999900000?text=${encodeURIComponent(`Farm For You உள்நுழைவுக் குறியீடு ${r.code}`)}`)
    expect(await wa.checkSignIn("f1", r.id, r.browserKey, at(5))).toEqual({ status: "waiting" })

    // The right code from someone else's number proves nothing.
    expect((await wa.receiveMessage("919000080002", `code ${r.code}`, at(10))).result).toBe("no_match")
    // A wrong code from the right number neither.
    expect((await wa.receiveMessage("919000080001", "code 000000", at(11))).result).toBe("no_match")

    const got = await wa.receiveMessage("919000080001", `Farm For You உள்நுழைவுக் குறியீடு ${r.code}`, at(20))
    expect(got).toEqual({ result: "proven", tenantId: "f1", language: "ta" })
    // Meta sends the same message again: nothing changes.
    expect((await wa.receiveMessage("919000080001", r.code, at(21))).result).toBe("repeat")

    // Another browser (or another farm) with the id but not the key gets nothing.
    expect(await wa.checkSignIn("f1", r.id, "not-the-key", at(22))).toEqual({ status: "gone" })
    expect(await wa.checkSignIn("f2", r.id, r.browserKey, at(22))).toEqual({ status: "gone" })
    expect(await wa.checkSignIn("f1", r.id, r.browserKey, at(23))).toEqual({ status: "proven", phone: PHONE })
    expect(await wa.checkSignIn("f1", r.id, r.browserKey, at(24))).toEqual({ status: "gone" })

    await wa.replyTo("919000080001", got)
    expect(replies.at(-1)).toMatchObject({ to: "919000080001" })
    expect(replies.at(-1)!.body).toContain("f1 Farm")
  })

  it("waits between requests, and a request runs out of time", async () => {
    expect(await wa.startSignIn({ id: "f1" }, PHONE, "ta", at(10))).toEqual({ ok: false, error: "otp_wait", seconds: 20 })
    const r = await start("f2", 100)
    expect(await wa.checkSignIn("f2", r.id, r.browserKey, at(100 + 601))).toEqual({ status: "expired" })
    expect((await wa.receiveMessage("919000080001", r.code, at(100 + 601))).result).toBe("no_match")
  })

  it("answers messages without a code, and ignores numbers outside India", async () => {
    expect((await wa.receiveMessage("919000080001", "hello, eggs today?", at(900))).result).toBe("no_code")
    expect((await wa.receiveMessage("14155550100", "123456", at(900))).result).toBe("not_indian")
    await wa.replyTo("919000080001", { result: "no_code" })
    expect(replies.at(-1)!.body).toContain("only for sign-in codes")
  })

  it("trusts only webhook calls signed with the app secret", () => {
    const body = JSON.stringify({ entry: [] })
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex")
    expect(cloud.signedByMeta(body, sig, "s3cret")).toBe(true)
    expect(cloud.signedByMeta(body + " ", sig, "s3cret")).toBe(false)
    expect(cloud.signedByMeta(body, sig, "other")).toBe(false)
    expect(cloud.signedByMeta(body, null, "s3cret")).toBe(false)
    expect(cloud.signedByMeta(body, sig, undefined)).toBe(false)
  })

  it("clears old requests", async () => {
    await wa.pruneSignIns(at(3 * 24 * 3600))
    expect(await prisma.whatsAppSignIn.count()).toBe(0)
  })

  it("runs the migration safely twice", async () => {
    const migration = readFileSync(path.join(__dirname, "../../prisma/sql/2026-11-15-whatsapp-sign-in.sql"), "utf8")
    await pg.exec(migration)
    await pg.exec(migration)
    expect(await prisma.whatsAppSignIn.count()).toBe(0)
  })
})
