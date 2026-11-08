import { describe, expect, it } from "vitest"
import {
  ageDays,
  batchMoney,
  batchStatus,
  checkBatch,
  checkBatchDay,
  dayOnFarm,
  feedStore,
  flockDays,
  hatchDate,
  hatchRatePct,
  lossesByCause,
  lossesValued,
  onFarm,
  weeksAndDays,
  type BatchDayRow,
  type BatchInfo,
  type BatchLossRow,
} from "./batches"

// 100 chicks bought at 3 days old, first day on the farm 1 Oct.
const B: BatchInfo = { id: "b1", number: 1, name: "Batch 1", purpose: "meat", source: "bought", startDate: "2026-10-01", ageAtStartDays: 3, startCount: 100, closedDate: null, eggValuePaise: null }
const day = (date: string, over: Partial<BatchDayRow> = {}): BatchDayRow => ({ batchId: "b1", date, feedKg: null, eggsCollected: null, eggsBroken: null, sold: 0, soldPaise: 0, given: 0, ...over })
const loss = (date: string, cause: string, count: number, batchId = "b1"): BatchLossRow => ({ batchId, date, cause, count })

describe("batch age and days", () => {
  it("works out the hatch day and age from the first day and age on arrival", () => {
    expect(hatchDate(B)).toBe("2026-09-28")
    expect(ageDays(B, "2026-10-01")).toBe(3)
    expect(ageDays(B, "2026-10-29")).toBe(31)
    expect(weeksAndDays(31)).toEqual({ weeks: 4, days: 3 })
    expect(dayOnFarm(B, "2026-10-01")).toBe(1)
    expect(dayOnFarm(B, "2026-10-10")).toBe(10)
  })

  it("is hatched on its first day when hatched here", () => {
    const h = { startDate: "2026-11-01", ageAtStartDays: 0 }
    expect(hatchDate(h)).toBe("2026-11-01")
    expect(ageDays(h, "2026-11-08")).toBe(7)
  })

  it("is on the farm from its first day until it closes", () => {
    expect(onFarm(B, "2026-09-30")).toBe(false)
    expect(onFarm(B, "2026-10-01")).toBe(true)
    expect(onFarm({ ...B, closedDate: "2026-12-01" }, "2026-12-01")).toBe(true)
    expect(onFarm({ ...B, closedDate: "2026-12-01" }, "2026-12-02")).toBe(false)
  })
})

describe("batch status on a day", () => {
  const days = [day("2026-10-01", { feedKg: 2 }), day("2026-10-02", { feedKg: 2.5 }), day("2026-10-20", { sold: 10, soldPaise: 450000, given: 2, feedKg: 6 })]
  const losses = [loss("2026-10-02", "weak", 3), loss("2026-10-05", "predator", 2), loss("2026-10-05", "culled", 1), loss("2026-10-05", "weak", 1), loss("2026-10-05", "disease", 9, "other")]

  it("counts birds alive from the start, never typed", () => {
    const s = batchStatus(B, days, losses, "2026-10-31")
    expect(s).toMatchObject({ lost: 7, died: 6, culled: 1, sold: 10, soldPaise: 450000, given: 2, alive: 81, lossPct: 7, feedKg: 10.5, daysEntered: 4, lastEntry: "2026-10-20", arrived: true, closed: false })
    expect(s.lostByCause).toEqual([
      { cause: "weak", count: 4 },
      { cause: "predator", count: 2 },
      { cause: "culled", count: 1 },
    ])
  })

  it("looks back to any past day using only what happened by then", () => {
    expect(batchStatus(B, days, losses, "2026-10-02")).toMatchObject({ alive: 97, lost: 3, sold: 0, ageDays: 4, dayOnFarm: 2, feedKg: 4.5 })
    expect(batchStatus(B, days, losses, "2026-09-30")).toMatchObject({ arrived: false, alive: 100, lost: 0 })
  })
})

describe("checking a day's entry", () => {
  const ok = { date: "2026-10-10", feedKg: 3, eggsCollected: null, eggsBroken: null, sold: 0, soldPaise: 0, given: 0 }
  const today = "2026-11-08"

  it("accepts a normal day", () => {
    expect(checkBatchDay(B, ok, [{ cause: "weak", count: 2 }], 0, today)).toBeNull()
  })

  it("refuses days outside the batch's time on the farm", () => {
    expect(checkBatchDay(B, { ...ok, date: "2026-11-09" }, [], 0, today)).toBe("record_future")
    expect(checkBatchDay(B, { ...ok, date: "2026-09-30" }, [], 0, today)).toBe("batch_before_start")
    expect(checkBatchDay({ ...B, closedDate: "2026-10-05" }, ok, [], 0, today)).toBe("batch_closed")
  })

  it("refuses odd numbers and causes", () => {
    expect(checkBatchDay(B, { ...ok, sold: -1 }, [], 0, today)).toBe("record_invalid")
    expect(checkBatchDay(B, { ...ok, feedKg: -2 }, [], 0, today)).toBe("record_invalid")
    expect(checkBatchDay(B, ok, [{ cause: "aliens", count: 1 }], 0, today)).toBe("record_invalid")
    expect(checkBatchDay(B, ok, [{ cause: "weak", count: 1.5 }], 0, today)).toBe("record_invalid")
    expect(checkBatchDay(B, { ...ok, eggsCollected: 5, eggsBroken: 6 }, [], 0, today)).toBe("broken_more_than_collected")
    expect(checkBatchDay(B, { ...ok, soldPaise: 5000 }, [], 0, today)).toBe("sold_money_without_birds")
  })

  it("never lets more birds leave than the batch started with", () => {
    expect(checkBatchDay(B, { ...ok, sold: 50 }, [{ cause: "weak", count: 10 }], 40, today)).toBeNull()
    expect(checkBatchDay(B, { ...ok, sold: 50 }, [{ cause: "weak", count: 11 }], 40, today)).toBe("more_out_than_birds")
  })
})

describe("checking a batch", () => {
  const nb = { startDate: "2026-11-01", ageAtStartDays: 0, startCount: 40, source: "hatched", eggsSet: 50 }
  it("accepts a sensible batch and refuses odd ones", () => {
    expect(checkBatch(nb, "2026-11-08")).toBeNull()
    expect(checkBatch({ ...nb, startDate: "2026-11-09" }, "2026-11-08")).toBe("record_future")
    expect(checkBatch({ ...nb, startCount: 0 }, "2026-11-08")).toBe("batch_count_invalid")
    expect(checkBatch({ ...nb, ageAtStartDays: -1 }, "2026-11-08")).toBe("batch_age_invalid")
    expect(checkBatch({ ...nb, eggsSet: 30 }, "2026-11-08")).toBe("hatched_more_than_set")
  })
  it("keeps a changed batch in line with its entries", () => {
    expect(checkBatch(nb, "2026-11-08", { outSoFar: 41, firstEntry: null })).toBe("batch_count_below_out")
    expect(checkBatch(nb, "2026-11-08", { outSoFar: 5, firstEntry: "2026-10-31" })).toBe("batch_start_after_entries")
    expect(checkBatch(nb, "2026-11-08", { outSoFar: 5, firstEntry: "2026-11-01" })).toBeNull()
  })
  it("gives the hatch rate", () => {
    expect(hatchRatePct({ eggsSet: 50, startCount: 40 })).toBe(80)
    expect(hatchRatePct({ eggsSet: null, startCount: 40 })).toBeNull()
  })
})

describe("feed store", () => {
  it("adds up feed bought with its kg, used, left and the average price", () => {
    const s = feedStore(
      [
        { quantityKg: 50, amountPaise: 150000 },
        { quantityKg: 50, amountPaise: 160000 },
        { quantityKg: null, amountPaise: 99999 },
      ],
      62.5
    )
    expect(s).toEqual({ boughtKg: 100, usedKg: 62.5, leftKg: 37.5, pricePerKgPaise: 3100 })
    expect(feedStore([], 10)).toEqual({ boughtKg: 0, usedKg: 10, leftKg: -10, pricePerKgPaise: null })
  })
})

describe("money per batch", () => {
  const s = { feedKg: 100, soldPaise: 4_500_000, eggsCollected: 0, eggsBroken: 0, lost: 10 }
  const spent = [
    { kind: "chicks", amountPaise: 500_000 },
    { kind: "medicine", amountPaise: 100_000 },
  ]
  it("sets birds sold against chicks, feed eaten and medicine", () => {
    const m = batchMoney(B, s, spent, 3000)
    expect(m).toMatchObject({ chicksPaise: 500_000, feedPaise: 300_000, otherPaise: 100_000, costPaise: 900_000, inPaise: 4_500_000, marginPaise: 3_600_000, costPerBirdPaise: 9000, lostValuePaise: 90_000 })
  })
  it("leaves feed out, and says so, until the price per kg is known", () => {
    expect(batchMoney(B, s, spent, null)).toMatchObject({ feedPaise: null, costPaise: 600_000 })
  })
  it("values eggs at the batch's egg value", () => {
    const layers = { ...B, eggValuePaise: 1200 }
    const m = batchMoney(layers, { ...s, soldPaise: 0, eggsCollected: 1010, eggsBroken: 10 }, spent, 3000)
    expect(m).toMatchObject({ eggsValuePaise: 1_200_000, inPaise: 1_200_000, costPerEggPaise: 900 })
    expect(batchMoney(B, { ...s, eggsCollected: 10 }, spent, 3000).eggsValuePaise).toBeNull()
  })
})

describe("the whole flock", () => {
  const b2: BatchInfo = { ...B, id: "b2", number: 2, startDate: "2026-10-03", ageAtStartDays: 0, startCount: 50 }
  const days = [day("2026-10-02", { feedKg: 2, eggsCollected: 30 }), day("2026-10-03", { feedKg: 2 }), { ...day("2026-10-03", { feedKg: 1 }), batchId: "b2" }]
  const losses = [loss("2026-10-03", "weak", 2, "b2"), loss("2026-10-03", "heat", 1)]

  it("adds up the batches per day, birds counted at the end of each day", () => {
    expect(flockDays([B, b2], days, losses, "2026-10-01", "2026-10-31")).toEqual([
      { date: "2026-10-02", eggsCollected: 30, eggsBroken: null, birds: 100, birdsLost: 0, feedKg: 2 },
      { date: "2026-10-03", eggsCollected: null, eggsBroken: null, birds: 147, birdsLost: 3, feedKg: 3 },
    ])
    expect(flockDays([B, b2], days, losses, "2026-10-03", "2026-10-03")).toHaveLength(1)
  })

  it("adds up losses by cause", () => {
    expect(lossesByCause([...losses, loss("2026-10-04", "weak", 1)])).toEqual([
      { cause: "weak", count: 3 },
      { cause: "heat", count: 1 },
    ])
  })
})

describe("losses in ₹", () => {
  it("prices each lost bird at its own batch's cost per bird, biggest loss first", () => {
    const cost = new Map([["b1", 5000], ["b2", 20000]])
    const rows = lossesValued([loss("2026-10-02", "disease", 3), loss("2026-10-03", "predator", 1, "b2"), loss("2026-10-04", "disease", 1, "b2")], cost)
    expect(rows).toEqual([
      { cause: "disease", count: 4, valuePaise: 35000 },
      { cause: "predator", count: 1, valuePaise: 20000 },
    ])
  })

  it("counts birds from a batch with no costs at ₹0", () => {
    expect(lossesValued([loss("2026-10-02", "heat", 2, "bx")], new Map())).toEqual([{ cause: "heat", count: 2, valuePaise: 0 }])
  })
})
