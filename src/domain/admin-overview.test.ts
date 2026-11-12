import { describe, expect, it } from "vitest"
import { auditGroup, checkServices, monthlyFeePaise, tickHealth, fillLevel } from "./admin-overview"

describe("monthly fees", () => {
  const plan = { monthlyPaise: 50_000, yearlyPaise: 500_000 }
  it("counts only paying farms: a trial, paused or ended farm brings nothing", () => {
    for (const status of ["trial", "paused", "ended"]) expect(monthlyFeePaise({ status, billingCycle: "monthly", priceOverridePaise: null }, plan)).toBe(0)
    expect(monthlyFeePaise({ status: "active", billingCycle: "monthly", priceOverridePaise: null }, plan)).toBe(50_000)
    // Past due is still owed
    expect(monthlyFeePaise({ status: "past_due", billingCycle: "monthly", priceOverridePaise: null }, plan)).toBe(50_000)
  })
  it("spreads a yearly price over 12 months, and uses the farm's own price when it has one", () => {
    expect(monthlyFeePaise({ status: "active", billingCycle: "yearly", priceOverridePaise: null }, plan)).toBe(41_667)
    expect(monthlyFeePaise({ status: "active", billingCycle: "yearly", priceOverridePaise: null }, { monthlyPaise: 10_000, yearlyPaise: null })).toBe(10_000)
    expect(monthlyFeePaise({ status: "active", billingCycle: "monthly", priceOverridePaise: 20_000 }, plan)).toBe(20_000)
  })
})

describe("service keys", () => {
  it("says ready, partly or missing from which keys are set, never their values", () => {
    const set = new Set(["DATABASE_URL", "DIRECT_URL", "WHATSAPP_API_TOKEN"])
    const checks = checkServices((n) => set.has(n))
    expect(checks.find((c) => c.key === "database")?.state).toBe("ready")
    expect(checks.find((c) => c.key === "whatsapp")?.state).toBe("partly")
    expect(checks.find((c) => c.key === "push")?.state).toBe("missing")
    expect(JSON.stringify(checks)).not.toMatch(/postgres|secret-value/)
  })
})

describe("limits and the tick", () => {
  it("watches from 60% and warns from 85%", () => {
    expect(fillLevel(100, 1000)).toEqual({ pct: 10, level: "ok" })
    expect(fillLevel(600, 1000).level).toBe("watch")
    expect(fillLevel(900, 1000).level).toBe("near")
    expect(fillLevel(5000, 1000).pct).toBe(100)
  })
  it("calls the tick late after 30 minutes without one", () => {
    const now = new Date("2026-11-12T10:00:00Z")
    expect(tickHealth(null, now)).toBe("never")
    expect(tickHealth(new Date("2026-11-12T09:45:00Z"), now)).toBe("running")
    expect(tickHealth(new Date("2026-11-12T09:20:00Z"), now)).toBe("late")
  })
  it("groups audit actions by their first word", () => {
    expect(auditGroup("plan.new_version")).toBe("plan")
    expect(auditGroup("setting.changed")).toBe("setting")
  })
})
