import { describe, expect, it } from "vitest"
import { canSend, checkCode, hashCode, newCode, CODE_TTL_MS } from "./otp"

const now = new Date("2026-10-22T10:00:00Z")
const ago = (ms: number) => new Date(now.getTime() - ms)

describe("one-time codes", () => {
  it("are six digits, keep leading zeros, and hash per farm and number", () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/)
    const h = hashCode("s", "t1", "+919000010001", "012345")
    expect(h).toBe(hashCode("s", "t1", "+919000010001", "012345"))
    expect(h).not.toBe(hashCode("s", "t2", "+919000010001", "012345"))
    expect(h).not.toBe(hashCode("s", "t1", "+919000010002", "012345"))
  })

  it("limit how often a number can be sent codes", () => {
    expect(canSend([], now)).toEqual({ ok: true })
    expect(canSend([ago(10_000)], now)).toEqual({ ok: false, reason: "wait", seconds: 20 })
    expect(canSend([ago(31_000)], now)).toEqual({ ok: true })
    expect(canSend([ago(60_000), ago(120_000), ago(180_000), ago(240_000)], now)).toEqual({ ok: false, reason: "too_many" })
    const day = Array.from({ length: 8 }, (_, i) => ago((i + 2) * 3600_000))
    expect(canSend(day, now)).toEqual({ ok: false, reason: "too_many" })
  })

  it("accept the right code once, before it expires and within 5 tries", () => {
    const h = hashCode("s", "t1", "p", "111111")
    const code = { codeHash: h, expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, usedAt: null }
    expect(checkCode(code, h, now)).toBe("ok")
    expect(checkCode(code, hashCode("s", "t1", "p", "222222"), now)).toBe("wrong")
    expect(checkCode({ ...code, expiresAt: ago(1) }, h, now)).toBe("expired")
    expect(checkCode({ ...code, attempts: 5 }, h, now)).toBe("too_many_tries")
    expect(checkCode({ ...code, usedAt: ago(1) }, h, now)).toBe("no_code")
    expect(checkCode(null, h, now)).toBe("no_code")
  })
})
