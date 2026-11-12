import { describe, expect, it } from "vitest"
import { cleanValue, groupsOf, NO_CONTROL, resolveAll, resolveSetting, SETTING_KEYS, SETTINGS, shownToFarm } from "./settings"
import { FEATURE_KEYS } from "./features"
import { MODULE_KEYS } from "./modules"

const FARM = "farm-1"

describe("the registry", () => {
  it("every setting's default is a valid value of its own type", () => {
    for (const k of SETTING_KEYS) expect(cleanValue(k, SETTINGS[k].default)).toEqual(SETTINGS[k].default)
  })
  it("names only real modules, features and on/off settings", () => {
    for (const k of SETTING_KEYS) {
      const d = SETTINGS[k] as { module: string; feature?: string; shownWhen?: string }
      expect(MODULE_KEYS).toContain(d.module)
      if (d.feature) expect(FEATURE_KEYS).toContain(d.feature)
      if (d.shownWhen) expect((SETTINGS as Record<string, { type: string }>)[d.shownWhen]?.type).toBe("boolean")
    }
  })
})

describe("cleanValue", () => {
  it("keeps numbers within limits and on their step", () => {
    expect(cleanValue("orderYellowHours", 0)).toBe(0.25)
    expect(cleanValue("orderYellowHours", 1000)).toBe(72)
    expect(cleanValue("orderYellowHours", 2.3)).toBe(2.25)
    expect(cleanValue("newCustomerOrderCount", 2.6)).toBe(3)
  })
  it("rejects the wrong kind of value", () => {
    expect(cleanValue("orderWaitingOn", "yes")).toBeUndefined()
    expect(cleanValue("orderRedHours", "4")).toBeUndefined()
    expect(cleanValue("orderRedHours", Number.NaN)).toBeUndefined()
  })
})

describe("resolveSetting: the nearest set value wins", () => {
  it("the default, when nobody has set anything", () => {
    expect(resolveSetting("orderRedHours", {}, NO_CONTROL, FARM)).toMatchObject({ value: 4, from: "default", usual: 4, farmMayChange: true })
  })
  it("Farm For You's value for every farm, then the farm's own", () => {
    expect(resolveSetting("orderRedHours", { platform: 6 }, NO_CONTROL, FARM)).toMatchObject({ value: 6, from: "platform", usual: 6 })
    expect(resolveSetting("orderRedHours", { platform: 6, farm: 3 }, NO_CONTROL, FARM)).toMatchObject({ value: 3, from: "farm", usual: 6 })
  })
  it("a bad saved value is skipped, not used", () => {
    expect(resolveSetting("orderRedHours", { platform: "x", farm: null }, NO_CONTROL, FARM)).toMatchObject({ value: 4, from: "default" })
  })
  it("a locked setting gives every farm Farm For You's value", () => {
    const r = resolveSetting("orderWaitingOn", { platform: false, farm: true }, { ...NO_CONTROL, locked: true }, FARM)
    expect(r).toMatchObject({ value: false, from: "platform", farmMayChange: false, locked: true, offered: true })
  })
  it("hidden, or offered only to other farms first: the farm's own value doesn't count", () => {
    expect(resolveSetting("lowStockAt", { farm: 9 }, { ...NO_CONTROL, hidden: true }, FARM)).toMatchObject({ value: 5, offered: false, farmMayChange: false })
    expect(resolveSetting("lowStockAt", { farm: 9 }, { ...NO_CONTROL, onlyFarms: ["other"] }, FARM)).toMatchObject({ value: 5, offered: false })
    expect(resolveSetting("lowStockAt", { farm: 9 }, { ...NO_CONTROL, onlyFarms: [FARM] }, FARM)).toMatchObject({ value: 9, offered: true })
  })
  it("Farm For You's own settings ignore farm values", () => {
    expect(resolveSetting("trialReminderDays", { platform: 5, farm: 9 }, NO_CONTROL, FARM)).toMatchObject({ value: 5, farmMayChange: false })
  })
  it("a person's own value counts only for staff or customer settings", () => {
    expect(resolveSetting("orderRedHours", { farm: 3, user: 8 }, NO_CONTROL, FARM)).toMatchObject({ value: 3, userMayChange: false })
  })
  it("Farm For You's own view has no farm layer", () => {
    expect(resolveSetting("orderRedHours", { platform: 6, farm: 3 }, NO_CONTROL, null)).toMatchObject({ value: 6, farmMayChange: false })
  })
})

describe("resolveAll", () => {
  it("reads each setting's layers from the saved rows", () => {
    const all = resolveAll(
      [
        { scope: "platform", key: "orderRedHours", value: 6 },
        { scope: "farm", key: "orderRedHours", value: 5 },
        { scope: "farm", key: "lowStockAt", value: 2 },
        { scope: "farm", key: "notASetting", value: 1 },
      ],
      { lowStockAt: { locked: true, hidden: false, onlyFarms: [] } },
      FARM,
    )
    expect(all.orderRedHours.value).toBe(5)
    expect(all.lowStockAt.value).toBe(5)
    expect(all.orderYellowHours.value).toBe(2)
  })
})

describe("shownToFarm", () => {
  const r = (key: "callWhatsAppOrders" | "orderRedHours" | "trialReminderOn", control = NO_CONTROL) => resolveSetting(key, {}, control, FARM)
  it("needs the module and the feature", () => {
    expect(shownToFarm("orderRedHours", r("orderRedHours"), ["core", "selling"], {})).toBe(true)
    expect(shownToFarm("orderRedHours", r("orderRedHours"), ["core"], {})).toBe(false)
    expect(shownToFarm("callWhatsAppOrders", r("callWhatsAppOrders"), ["core", "selling"], { callConfirmation: false })).toBe(false)
    expect(shownToFarm("callWhatsAppOrders", r("callWhatsAppOrders"), ["core", "selling"], { callConfirmation: true })).toBe(true)
  })
  it("never shows Farm For You's own settings or hidden ones; shows locked ones", () => {
    expect(shownToFarm("trialReminderOn", r("trialReminderOn"), ["core"], {})).toBe(false)
    expect(shownToFarm("orderRedHours", r("orderRedHours", { ...NO_CONTROL, hidden: true }), ["selling"], {})).toBe(false)
    expect(shownToFarm("orderRedHours", r("orderRedHours", { ...NO_CONTROL, locked: true }), ["selling"], {})).toBe(true)
  })
})

describe("groupsOf", () => {
  it("groups a module's settings under their headings, in order", () => {
    expect(groupsOf("selling").map((g) => g.group)).toEqual(["orders", "calls", "stock"])
    expect(groupsOf("core").map((g) => g.group)).toEqual(["trial"])
    expect(groupsOf("fishery")).toEqual([])
  })
})
