import { describe, expect, it } from "vitest"
import { resolveFeatures } from "@/domain/features"
import { mainMenu, menuItemActive, moneyTabs, moreTiles, poultryTabs } from "./farm-sections"

const withPoultry = resolveFeatures("pro", { poultryCare: true })
const plain = resolveFeatures("pro", {})
const keys = (xs: { key: string }[]) => xs.map((x) => x.key)

describe("the bottom menu", () => {
  it("gives the owner of a poultry farm all five buttons", () => {
    expect(keys(mainMenu({ roles: ["owner"], features: withPoultry }))).toEqual(["today", "orders", "poultry", "money", "more"])
  })

  it("leaves Poultry out when the farm doesn't use Poultry care", () => {
    expect(keys(mainMenu({ roles: ["owner"], features: plain }))).toEqual(["today", "orders", "money", "more"])
  })

  it("shows delivery staff only what they use: no poultry, no money", () => {
    expect(keys(mainMenu({ roles: ["delivery"], features: withPoultry }))).toEqual(["today", "orders", "more"])
  })

  it("lets packing staff into Poultry and only the Made tab of Money", () => {
    const menu = mainMenu({ roles: ["packing"], features: withPoultry })
    expect(keys(menu)).toEqual(["today", "orders", "poultry", "money", "more"])
    expect(menu.find((m) => m.key === "money")?.href).toBe("/farm/money/made")
    expect(keys(moneyTabs({ roles: ["packing"], features: withPoultry }))).toEqual(["made"])
    expect(keys(poultryTabs({ roles: ["packing"], features: withPoultry }))).toEqual(["batches", "vaccines", "feed"])
  })

  it("gives a manager everything the owner has, except the Staff list", () => {
    const owner = { roles: ["owner"], features: withPoultry }
    const manager = { roles: ["manager"], features: withPoultry }
    expect(mainMenu(manager)).toEqual(mainMenu(owner))
    expect(moneyTabs(manager)).toEqual(moneyTabs(owner))
    expect(poultryTabs(manager)).toEqual(poultryTabs(owner))
    const ownerTiles = keys(moreTiles(owner))
    expect(ownerTiles).toContain("staff")
    expect(keys(moreTiles(manager))).toEqual(ownerTiles.filter((k) => k !== "staff"))
  })

  it("lights up the right button for every page", () => {
    const menu = mainMenu({ roles: ["owner"], features: withPoultry })
    const lit = (path: string) => menu.filter((m) => menuItemActive(m, path)).map((m) => m.key)
    expect(lit("/farm")).toEqual(["today"])
    expect(lit("/farm/orders/abc/edit")).toEqual(["orders"])
    expect(lit("/farm/poultry/batches/abc")).toEqual(["poultry"])
    expect(lit("/farm/poultry/costs")).toEqual(["poultry"])
    expect(lit("/farm/money/profit")).toEqual(["money"])
    expect(lit("/farm/customers/abc")).toEqual(["more"])
    expect(lit("/farm/settings/look")).toEqual(["more"])
    // "/farm/money" must not light up for a page that only starts with the same letters.
    expect(lit("/farm/moneybox")).toEqual([])
  })
})

describe("the More page", () => {
  it("shows the owner everything the farm has switched on", () => {
    expect(keys(moreTiles({ roles: ["owner"], features: plain }))).toEqual(["products", "customers", "slots", "messages", "whatsapp", "staff", "settings", "account"])
  })

  it("adds Plans only when regular orders are switched on", () => {
    expect(keys(moreTiles({ roles: ["owner"], features: resolveFeatures("pro", { subscriptions: true }) }))).toContain("plans")
  })

  it("keeps Staff and Settings for the owner; delivery staff get only their account", () => {
    expect(keys(moreTiles({ roles: ["order_desk"], features: plain }))).not.toContain("settings")
    expect(keys(moreTiles({ roles: ["delivery"], features: plain }))).toEqual(["account"])
  })
})
