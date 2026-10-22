import { describe, expect, it } from "vitest"
import { checkStaffChange, tempPassword } from "./staff"

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
