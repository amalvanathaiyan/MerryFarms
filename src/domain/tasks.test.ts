import { describe, expect, it } from "vitest"
import { dueNow, farmReminders, nextDue, seesTask, taskState } from "./tasks"

const job = (dueOn: string, over: object = {}) => ({ dueOn, repeatEvery: null, repeatUnit: null, doneOn: null, ...over })

describe("farm jobs", () => {
  it("keeps a repeating job's rhythm when done on time or early, and moves on from the day done when late", () => {
    const weekly = { dueOn: "2026-11-15", repeatEvery: 1, repeatUnit: "week" }
    expect(nextDue(weekly, "2026-11-15")).toBe("2026-11-22")
    expect(nextDue(weekly, "2026-11-13")).toBe("2026-11-22")
    expect(nextDue(weekly, "2026-11-18")).toBe("2026-11-25")
    expect(nextDue({ dueOn: "2026-01-31", repeatEvery: 1, repeatUnit: "month" }, "2026-01-31")).toBe("2026-02-28")
    expect(nextDue({ dueOn: "2026-11-15", repeatEvery: 3, repeatUnit: "day" }, "2026-11-15")).toBe("2026-11-18")
  })
  it("says when a job is due", () => {
    const today = "2026-11-15"
    expect(["2026-11-14", "2026-11-15", "2026-11-22", "2026-11-23"].map((d) => taskState(job(d), today))).toEqual(["late", "today", "soon", "later"])
    expect(taskState(job("2026-11-14", { doneOn: "2026-11-14" }), today)).toBe("done")
    expect(dueNow([job("2026-11-16"), job("2026-11-15"), job("2026-11-01"), job("2026-11-01", { doneOn: "2026-11-02" })], today).map((t) => t.dueOn)).toEqual(["2026-11-01", "2026-11-15"])
  })
  it("shows a job to the one it's for, or else to the owner and managers", () => {
    const packer = { id: "p", roles: ["packing"] }
    const manager = { id: "m", roles: ["manager"] }
    expect(seesTask({ forStaffId: null }, packer)).toBe(false)
    expect(seesTask({ forStaffId: null }, manager)).toBe(true)
    expect(seesTask({ forStaffId: "p" }, packer)).toBe(true)
    expect(seesTask({ forStaffId: "p" }, manager)).toBe(false)
  })
  it("reminds of machines due for a service and the store running low, never twice for the hens' feed", () => {
    const today = "2026-11-15"
    const assets = [
      { id: "a", name: "Motor", serviceEveryDays: 90, lastServiceOn: "2026-08-10", boughtOn: null, retiredAt: null }, // due 11-08: late
      { id: "b", name: "Tractor", serviceEveryDays: 30, lastServiceOn: "2026-10-18", boughtOn: null, retiredAt: null }, // due 11-17: soon
      { id: "c", name: "Pump", serviceEveryDays: 30, lastServiceOn: "2026-11-01", boughtOn: null, retiredAt: null }, // due 12-01
      { id: "d", name: "Old", serviceEveryDays: 30, lastServiceOn: "2026-01-01", boughtOn: null, retiredAt: new Date() },
    ]
    const item = (id: string, left: number, lowAt: number | null, batchFeed = false) => ({ item: { id, name: id, unit: "kg", lowAt, batchFeed, retiredAt: null }, stock: { left } })
    const store = [item("urea", 2, 3), item("seed", 10, 3), item("hen", 5, 50, true)]
    expect(farmReminders(assets, store, today, false).map((r) => r.id)).toEqual(["a", "b", "urea", "hen"])
    expect(farmReminders(assets, store, today, true).map((r) => r.id)).toEqual(["a", "b", "urea"])
    expect(farmReminders(assets, store, today, false)[0]).toMatchObject({ kind: "service", on: "2026-11-08", days: -7 })
  })
})
