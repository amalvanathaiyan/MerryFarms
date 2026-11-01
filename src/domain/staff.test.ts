import { describe, expect, it } from "vitest"
import { checkStaffChange, internalStaffEmail, nextStaffCode, normaliseStaffCode } from "./staff"
import { tempPassword } from "./staff-password"

const owner = { id: "o", roles: ["owner" as const], isActive: true }
const desk = { id: "d", roles: ["order_desk" as const], isActive: true }
const owner2 = { id: "o2", roles: ["owner" as const, "delivery" as const], isActive: true }

describe("staff changes", () => {
  it("keep at least one active owner", () => {
    expect(checkStaffChange([owner, desk], "o", "o", { kind: "roles", roles: ["order_desk"] })).toBe("last_owner")
    expect(checkStaffChange([owner, owner2, desk], "o", "o2", { kind: "roles", roles: ["delivery"] })).toBeNull()
    expect(checkStaffChange([owner, { ...owner2, isActive: false }], "o2", "o", { kind: "deactivate" })).toBe("last_owner")
  })

  it("stop an owner locking themselves out", () => {
    expect(checkStaffChange([owner, owner2], "o", "o", { kind: "deactivate" })).toBe("cannot_change_self")
    expect(checkStaffChange([owner, owner2], "o", "o", { kind: "roles", roles: ["packing"] })).toBe("cannot_change_self")
    expect(checkStaffChange([owner, owner2], "o", "o", { kind: "roles", roles: ["owner", "delivery"] })).toBeNull()
  })

  it("allow ordinary changes and need at least one role", () => {
    expect(checkStaffChange([owner, desk], "o", "d", { kind: "deactivate" })).toBeNull()
    expect(checkStaffChange([owner, desk], "o", "d", { kind: "roles", roles: [] })).toBe("roles_required")
    expect(checkStaffChange([owner, desk], "o", "x", { kind: "reactivate" })).toBe("staff_not_found")
  })

  it("make readable temporary passwords", () => {
    const seen = new Set(Array.from({ length: 50 }, tempPassword))
    for (const p of seen) expect(p).toMatch(/^Farm-\d{4}-[a-z]{4}$/)
    expect(seen.size).toBeGreaterThan(45)
  })
})

describe("staff IDs", () => {
  it("number on from the highest ID, whatever order they were made in", () => {
    expect(nextStaffCode("merryfarms", [])).toBe("MER-001")
    expect(nextStaffCode("merryfarms", ["MER-001", "MER-007", null])).toBe("MER-008")
    expect(nextStaffCode("a-b-farm", [])).toBe("ABF-001")
    expect(nextStaffCode("merryfarms", ["MER-999"])).toBe("MER-1000")
  })

  it("read the same however they are typed", () => {
    expect(normaliseStaffCode("  mer-002 ")).toBe("MER-002")
  })

  it("keep hidden login emails apart between farms with the same prefix", () => {
    expect(internalStaffEmail("MER-001", "farm-a")).not.toBe(internalStaffEmail("MER-001", "farm-b"))
  })
})
