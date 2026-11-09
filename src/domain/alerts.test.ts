import { describe, expect, it } from "vitest"
import { addDays } from "./ist"
import { batchesNotEntered, farmAlerts, feedDaysLeft, layingDrop, unusualLosses } from "./alerts"
import type { BatchDayRow, BatchInfo, BatchLossRow } from "./batches"

const TODAY = "2026-11-09"
const batch = (over: Partial<BatchInfo> = {}): BatchInfo => ({
  id: "b1",
  number: 1,
  name: "Layers",
  purpose: "eggs",
  source: "bought",
  startDate: "2026-09-01",
  ageAtStartDays: 150,
  startCount: 200,
  closedDate: null,
  eggValuePaise: null,
  ...over,
})
const day = (date: string, over: Partial<BatchDayRow> = {}): BatchDayRow => ({ batchId: "b1", date, feedKg: 10, eggsCollected: null, eggsBroken: null, sold: 0, soldPaise: 0, given: 0, ...over })
const loss = (date: string, count: number, batchId = "b1"): BatchLossRow => ({ batchId, date, cause: "disease", count })
const week = (until: string, n = 7, over: Partial<BatchDayRow> = {}) => Array.from({ length: n }, (_, i) => day(addDays(until, -i), over))

describe("unusual losses", () => {
  it("ignores an ordinary day: 1 bird when 1 a day is usual", () => {
    const days = week(TODAY, 8)
    const losses = [...week(addDays(TODAY, -1)).map((d) => loss(d.date, 1)), loss(TODAY, 1)]
    expect(unusualLosses(batch(), days, losses, TODAY)).toBeNull()
  })

  it("flags 3 or more when that is over twice the usual", () => {
    const days = week(TODAY, 8)
    const losses = [loss(addDays(TODAY, -2), 1), loss(TODAY, 4)]
    expect(unusualLosses(batch(), days, losses, TODAY)).toEqual({ lost: 4, usual: 0.1 })
  })

  it("does not flag 3 when 2 a day is already usual", () => {
    const days = week(TODAY, 8)
    const losses = [...week(addDays(TODAY, -1)).map((d) => loss(d.date, 2)), loss(TODAY, 3)]
    expect(unusualLosses(batch(), days, losses, TODAY)).toBeNull()
  })

  it("flags a small batch losing 5% in a day, even 2 birds", () => {
    expect(unusualLosses(batch({ startCount: 30 }), week(TODAY, 8), [loss(TODAY, 2)], TODAY)).toEqual({ lost: 2, usual: 0 })
  })
})

describe("egg laying drop", () => {
  const laying = (rates: number[]) => rates.map((r, i) => day(addDays(TODAY, -(rates.length - 1 - i)), { eggsCollected: Math.round((r / 100) * 200) }))

  it("flags the last 3 days a fifth or more below the 7 before", () => {
    expect(layingDrop(batch(), laying([80, 80, 80, 80, 80, 80, 80, 55, 55, 55]), [], TODAY)).toEqual({ before: 80, now: 55 })
  })

  it("ignores a small dip, a batch not yet laying, and too few days", () => {
    expect(layingDrop(batch(), laying([80, 80, 80, 80, 80, 80, 80, 70, 70, 70]), [], TODAY)).toBeNull()
    expect(layingDrop(batch(), laying([10, 10, 10, 10, 10, 10, 10, 2, 2, 2]), [], TODAY)).toBeNull()
    expect(layingDrop(batch(), laying([80, 80, 80, 50, 50]), [], TODAY)).toBeNull()
  })
})

describe("feed days left", () => {
  it("divides the feed left by the recent daily feed (entered days only)", () => {
    expect(feedDaysLeft({ boughtKg: 500, leftKg: 60 }, [day(TODAY, { feedKg: 12 }), day(addDays(TODAY, -3), { feedKg: 8 })], TODAY)).toEqual({ daysLeft: 6, perDay: 10 })
  })

  it("says nothing without a feed store or recent feeding", () => {
    expect(feedDaysLeft({ boughtKg: 0, leftKg: 0 }, [day(TODAY)], TODAY)).toBeNull()
    expect(feedDaysLeft({ boughtKg: 500, leftKg: 60 }, [day(addDays(TODAY, -10))], TODAY)).toBeNull()
  })
})

describe("the farm's alerts", () => {
  it("collects losses, feed running out and a laying drop; nothing when all is well", () => {
    const b2 = batch({ id: "b2", name: "Broilers", purpose: "meat", startCount: 100 })
    const days = [...week(TODAY, 8, { feedKg: 20 }), ...week(TODAY, 8, { feedKg: 10 }).map((d) => ({ ...d, batchId: "b2" }))]
    const alerts = farmAlerts([batch(), b2], days, [loss(TODAY, 6, "b2")], { boughtKg: 1000, leftKg: 150 }, TODAY)
    expect(alerts.map((a) => a.kind)).toEqual(["losses", "feed"])
    expect(alerts[0]).toMatchObject({ batchName: "Broilers", lost: 6 })
    expect(alerts[1]).toMatchObject({ daysLeft: 5 })
    expect(farmAlerts([batch()], week(TODAY, 8), [], { boughtKg: 1000, leftKg: 900 }, TODAY)).toEqual([])
  })

  it("looks at yesterday's losses when today isn't entered yet", () => {
    const days = week(addDays(TODAY, -1), 8)
    const alerts = farmAlerts([batch({ startCount: 50 })], days, [loss(addDays(TODAY, -1), 4)], null, TODAY)
    expect(alerts).toEqual([{ kind: "losses", batchId: "b1", batchName: "Layers", date: addDays(TODAY, -1), lost: 4, usual: 0 }])
  })

  it("lists batches with nothing entered today", () => {
    const b2 = batch({ id: "b2", name: "Broilers" })
    const closed = batch({ id: "b3", name: "Old", closedDate: "2026-10-01" })
    expect(batchesNotEntered([batch(), b2, closed], [day(TODAY)], [], TODAY).map((b) => b.name)).toEqual(["Broilers"])
  })
})
