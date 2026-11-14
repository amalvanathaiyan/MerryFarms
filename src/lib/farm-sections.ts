/**
 * The farm app's menu in one place: the sections, their colours, their tabs, and who sees what.
 * The bottom menu, the More page and each section's title and tabs all read from here, so a farm
 * (or a staff member) never sees a button that leads to a page they can't open.
 *
 * Every class string is written out in full so Tailwind generates it (see the sec-* colours in globals.css).
 */
import { effectiveRoles } from "@/domain/staff"
import type { FeatureSet } from "@/domain/features"

export type SectionKey =
  | "today"
  | "orders"
  | "poultry"
  | "money"
  | "more"
  | "products"
  | "land"
  | "customers"
  | "slots"
  | "messages"
  | "whatsapp"
  | "plans"
  | "staff"
  | "settings"
  | "account"

export interface SectionLook {
  /** Strong colour with readable text on it: active tab, round icon, main button. */
  strong: string
  /** Soft panel behind dark text. */
  tint: string
  /** The colour as text (an icon on white, a selected label). */
  text: string
  border: string
}

export const SECTION_LOOK: Record<SectionKey, SectionLook> = {
  today: { strong: "bg-sec-today text-sec-on", tint: "bg-sec-today-tint", text: "text-sec-today", border: "border-sec-today" },
  orders: { strong: "bg-sec-orders text-sec-on", tint: "bg-sec-orders-tint", text: "text-sec-orders", border: "border-sec-orders" },
  poultry: { strong: "bg-sec-poultry text-sec-on", tint: "bg-sec-poultry-tint", text: "text-sec-poultry", border: "border-sec-poultry" },
  money: { strong: "bg-sec-money text-sec-on", tint: "bg-sec-money-tint", text: "text-sec-money", border: "border-sec-money" },
  more: { strong: "bg-sec-more text-sec-on", tint: "bg-sec-more-tint", text: "text-sec-more", border: "border-sec-more" },
  products: { strong: "bg-sec-products text-sec-on", tint: "bg-sec-products-tint", text: "text-sec-products", border: "border-sec-products" },
  // My farm (Farm Core): places and assets, in the plans colour
  land: { strong: "bg-sec-plans text-sec-on", tint: "bg-sec-plans-tint", text: "text-sec-plans", border: "border-sec-plans" },
  customers: { strong: "bg-sec-customers text-sec-on", tint: "bg-sec-customers-tint", text: "text-sec-customers", border: "border-sec-customers" },
  slots: { strong: "bg-sec-slots text-sec-on", tint: "bg-sec-slots-tint", text: "text-sec-slots", border: "border-sec-slots" },
  messages: { strong: "bg-sec-messages text-sec-on", tint: "bg-sec-messages-tint", text: "text-sec-messages", border: "border-sec-messages" },
  whatsapp: { strong: "bg-sec-whatsapp text-sec-on", tint: "bg-sec-whatsapp-tint", text: "text-sec-whatsapp", border: "border-sec-whatsapp" },
  plans: { strong: "bg-sec-plans text-sec-on", tint: "bg-sec-plans-tint", text: "text-sec-plans", border: "border-sec-plans" },
  staff: { strong: "bg-sec-staff text-sec-on", tint: "bg-sec-staff-tint", text: "text-sec-staff", border: "border-sec-staff" },
  settings: { strong: "bg-sec-more text-sec-on", tint: "bg-sec-more-tint", text: "text-sec-more", border: "border-sec-more" },
  account: { strong: "bg-sec-account text-sec-on", tint: "bg-sec-account-tint", text: "text-sec-account", border: "border-sec-account" },
}

export type Role = "owner" | "manager" | "order_desk" | "packing" | "delivery"

export interface Who {
  roles: readonly string[]
  features: FeatureSet
}

/** A manager acts as owner (see effectiveRoles), so menus follow the same rule as the pages. */
const has = (who: Who, ...roles: Role[]) => effectiveRoles(who.roles).some((r) => (roles as string[]).includes(r))

export interface Tab {
  key: string
  href: string
  /** Words already translated (otherwise farm.tabs.<section>.<key>). */
  label?: string
  /** Picture name for SectionIcon (otherwise the key). */
  icon?: string
  /** A number shown on the tab (orders waiting). */
  count?: number
}

/** Poultry care's tabs. Costs shows money, so it is the owner's. */
export function poultryTabs(who: Who): Tab[] {
  if (!who.features.poultryCare || !has(who, "owner", "packing")) return []
  // Staff come here to enter the day, so Entry comes first for them; the owner starts from the batches.
  const owner = has(who, "owner")
  const entry = { key: "entry", href: "/farm/poultry/entry" }
  const batches = { key: "batches", href: "/farm/poultry" }
  return [
    ...(owner ? [batches, entry] : [entry, batches]),
    { key: "feed", href: "/farm/poultry/feed" },
    { key: "vaccines", href: "/farm/poultry/vaccines" },
    { key: "growth", href: "/farm/poultry/growth" },
    ...(owner ? [{ key: "costs", href: "/farm/poultry/costs" }] : []),
  ]
}

/** Money's tabs: packing staff only enter what was made; the rest is the owner's (and a manager's). */
export function moneyTabs(who: Who): Tab[] {
  const owner = has(who, "owner")
  const tabs: Tab[] = []
  if (owner && who.features.reports) tabs.push({ key: "sales", href: "/farm/money" })
  if (who.features.farmRecords && has(who, "owner", "manager")) tabs.push({ key: "spending", href: "/farm/money/spending" })
  if (who.features.farmRecords && has(who, "owner", "packing")) tabs.push({ key: "made", href: "/farm/money/made" })
  if (owner && who.features.farmRecords) tabs.push({ key: "profit", href: "/farm/money/profit" })
  return tabs
}

/** My farm (Farm Core)'s tabs: its places (land, sheds, ponds, wells) and assets (motors, tractors). */
export function landTabs(): Tab[] {
  return [
    { key: "places", href: "/farm/land" },
    { key: "assets", href: "/farm/land/assets" },
  ]
}

/** Settings' tabs (owner only; the pages check that). Videos only when the farm has them switched on. */
export function settingsTabs(features: { farmVideos: boolean }): Tab[] {
  return [
    { key: "shop", href: "/farm/settings" },
    { key: "delivery", href: "/farm/settings/delivery" },
    { key: "look", href: "/farm/settings/look" },
    ...(features.farmVideos ? [{ key: "videos", href: "/farm/settings/videos" }] : []),
    { key: "choices", href: "/farm/settings/choices" },
    { key: "plan", href: "/farm/settings/plan" },
  ]
}

export interface MenuItem {
  key: "today" | "orders" | "poultry" | "money" | "more"
  href: string
  /** Paths that light this button up. */
  prefixes: string[]
}

/** Pages reached from More: they light up the More button. */
const MORE_PATHS = ["/farm/more", "/farm/land", "/farm/catalogue", "/farm/customers", "/farm/slots", "/farm/messages", "/farm/whatsapp", "/farm/plans", "/farm/staff", "/farm/settings", "/farm/account"]

/** The bottom menu for this person: at most five big buttons. */
export function mainMenu(who: Who): MenuItem[] {
  const poultry = poultryTabs(who)
  const money = moneyTabs(who)
  return [
    { key: "today" as const, href: "/farm", prefixes: [] },
    { key: "orders" as const, href: "/farm/orders", prefixes: ["/farm/orders", "/farm/invoices"] },
    ...(poultry.length ? [{ key: "poultry" as const, href: poultry[0].href, prefixes: ["/farm/poultry"] }] : []),
    ...(money.length ? [{ key: "money" as const, href: money[0].href, prefixes: ["/farm/money"] }] : []),
    { key: "more" as const, href: "/farm/more", prefixes: MORE_PATHS },
  ]
}

export const menuItemActive = (item: MenuItem, path: string) => (item.key === "today" ? path === "/farm" : item.prefixes.some((p) => path === p || path.startsWith(`${p}/`)))

export type MoreKey = "land" | "products" | "customers" | "slots" | "messages" | "whatsapp" | "plans" | "staff" | "settings" | "account"

export interface MoreTile {
  key: MoreKey
  href: string
}

/** The More page's tiles for this person. */
export function moreTiles(who: Who): MoreTile[] {
  const desk = has(who, "owner", "order_desk")
  const f = who.features
  const tiles: (MoreTile | false)[] = [
    // My farm: the owner and a manager keep the farm's places and assets
    has(who, "owner") && { key: "land", href: "/farm/land" },
    has(who, "owner", "order_desk", "packing") && { key: "products", href: "/farm/catalogue" },
    desk && { key: "customers", href: "/farm/customers" },
    desk && { key: "slots", href: "/farm/slots" },
    desk && f.messages && { key: "messages", href: "/farm/messages" },
    desk && f.whatsappLite && { key: "whatsapp", href: "/farm/whatsapp" },
    desk && f.subscriptions && { key: "plans", href: "/farm/plans" },
    // Stored roles: the staff list stays with real owners, not managers.
    who.roles.includes("owner") && { key: "staff", href: "/farm/staff" },
    has(who, "owner") && { key: "settings", href: "/farm/settings" },
    { key: "account", href: "/farm/account" },
  ]
  return tiles.filter((t): t is MoreTile => !!t)
}
