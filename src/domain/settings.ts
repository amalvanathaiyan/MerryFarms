/**
 * The settings registry (docs/platform-plan.md §4): every setting in the app, in one list.
 *
 * Each setting has a type, a default, the module it belongs to, a group (a heading on the Settings page) and who may
 * change it. A value is worked out in layers, the nearest set value winning:
 *     the setting's default → Farm For You's value for every farm → the farm's own → the person's own
 * Farm For You admin can also lock a setting (its value for every farm, which farms can't change), hide it from
 * farms, or offer it only to chosen farms first. The farm's Settings page is drawn from this list, so a new setting
 * needs no new screen. Pure, so it is tested; src/server/settings.ts loads and saves.
 *
 * Adding a setting: add it to SETTINGS, add its Tamil and English words under settings.<key> (label, and hint if it
 * needs one) in messages/*.json, and read it with loadSettings(...).<key>.value.
 */
import type { FeatureKey } from "./features"
import type { ModuleKey } from "./modules"

/** Who may change it: only Farm For You admin, the farm's owner, each staff member, or each customer. */
export type SettingWho = "platform" | "owner" | "staff" | "customer"
export type SettingUnit = "hours" | "days" | "minutes" | "times" | "orders" | "units" | "rupees"

/** Headings on the Settings page, in this order inside each module. */
export const SETTING_GROUPS = ["orders", "calls", "stock", "trial"] as const
export type SettingGroup = (typeof SETTING_GROUPS)[number]

interface Base {
  module: ModuleKey
  group: SettingGroup
  who: SettingWho
  /** A feature that must be on for the setting to matter (it is shown only then). */
  feature?: FeatureKey
  /** An on/off setting that must be on for this one to matter (it is greyed out otherwise). */
  shownWhen?: string
}
export interface BooleanDef extends Base {
  type: "boolean"
  default: boolean
}
export interface NumberDef extends Base {
  type: "number"
  default: number
  min: number
  max: number
  step: number
  unit: SettingUnit
}
export interface ChoiceDef extends Base {
  type: "choice"
  default: string
  choices: readonly string[]
}
export type SettingDef = BooleanDef | NumberDef | ChoiceDef

export const SETTINGS = {
  // Selling · Orders: an order still waiting to be confirmed turns yellow, then red; staff get one alert at red.
  orderWaitingOn: { type: "boolean", default: true, module: "selling", group: "orders", who: "owner" },
  orderYellowHours: { type: "number", default: 2, min: 0.25, max: 72, step: 0.25, unit: "hours", module: "selling", group: "orders", who: "owner", shownWhen: "orderWaitingOn" },
  orderRedHours: { type: "number", default: 4, min: 0.5, max: 96, step: 0.25, unit: "hours", module: "selling", group: "orders", who: "owner", shownWhen: "orderWaitingOn" },

  // Selling · Confirmation calls: which orders the farm phones the customer about before packing.
  callWhatsAppOrders: { type: "boolean", default: true, module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },
  callWebOrdersFromNew: { type: "boolean", default: true, module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },
  newCustomerOrderCount: { type: "number", default: 3, min: 1, max: 50, step: 1, unit: "orders", module: "selling", group: "calls", who: "owner", feature: "callConfirmation", shownWhen: "callWebOrdersFromNew" },
  callAboveRupees: { type: "number", default: 1500, min: 0, max: 1_000_000, step: 1, unit: "rupees", module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },
  callAboveUsualTimes: { type: "number", default: 3, min: 0, max: 20, step: 1, unit: "times", module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },
  skipCallForTrusted: { type: "boolean", default: true, module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },
  skipCallForPrepaid: { type: "boolean", default: true, module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },
  maxCallAttempts: { type: "number", default: 3, min: 1, max: 10, step: 1, unit: "times", module: "selling", group: "calls", who: "owner", feature: "callConfirmation" },

  // Selling · Stock: a product down to this many: the owner and packing staff get one alert that day.
  lowStockOn: { type: "boolean", default: true, module: "selling", group: "stock", who: "owner", feature: "stockTracking" },
  lowStockAt: { type: "number", default: 5, min: 0, max: 100_000, step: 1, unit: "units", module: "selling", group: "stock", who: "owner", feature: "stockTracking", shownWhen: "lowStockOn" },

  // Farm Core · Free trial (Farm For You only): each farm's owner is reminded before their free trial ends.
  trialReminderOn: { type: "boolean", default: true, module: "core", group: "trial", who: "platform" },
  trialReminderDays: { type: "number", default: 3, min: 1, max: 30, step: 1, unit: "days", module: "core", group: "trial", who: "platform", shownWhen: "trialReminderOn" },
} as const satisfies Record<string, SettingDef>

export type SettingKey = keyof typeof SETTINGS
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[]
export const isSettingKey = (k: unknown): k is SettingKey => typeof k === "string" && Object.hasOwn(SETTINGS, k)

type DefOf<K extends SettingKey> = (typeof SETTINGS)[K]
export type SettingValue<K extends SettingKey> = DefOf<K>["type"] extends "boolean" ? boolean : DefOf<K>["type"] extends "number" ? number : string
export type AnyValue = boolean | number | string

const def = (key: SettingKey) => SETTINGS[key] as SettingDef

/** A value read defensively for this setting: kept within its limits, or undefined if it isn't one. */
export function cleanValue(key: SettingKey, raw: unknown): AnyValue | undefined {
  const d = def(key)
  if (d.type === "boolean") return typeof raw === "boolean" ? raw : undefined
  if (d.type === "number") {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined
    const stepped = Math.round(raw / d.step) * d.step
    return Math.min(d.max, Math.max(d.min, Number(stepped.toFixed(4))))
  }
  return typeof raw === "string" && d.choices.includes(raw) ? raw : undefined
}

/** Farm For You's controls on one setting. */
export interface SettingControl {
  /** Every farm gets Farm For You's value and can't change it. */
  locked: boolean
  /** Farms don't see it (they get Farm For You's value). */
  hidden: boolean
  /** Offered only to these farms first (empty = every farm); the rest get Farm For You's value. */
  onlyFarms: string[]
}
export const NO_CONTROL: SettingControl = { locked: false, hidden: false, onlyFarms: [] }

export interface Layers {
  platform?: unknown
  farm?: unknown
  user?: unknown
}
export type SettingSource = "default" | "platform" | "farm" | "user"

export interface Resolved<V extends AnyValue = AnyValue> {
  value: V
  from: SettingSource
  /** What the farm gets when it hasn't set its own: Farm For You's value, else the default. */
  usual: V
  /** The farm (owner) may change it. */
  farmMayChange: boolean
  /** Each person may set their own (staff or customer settings, when the farm may change it). */
  userMayChange: boolean
  /** Locked by Farm For You: shown to farms, but they can't change it. */
  locked: boolean
  /** Not hidden and offered to this farm. */
  offered: boolean
}

/** Whether Farm For You offers the setting to this farm (not hidden; in its first-farms list, if it has one). */
export function offeredTo(control: SettingControl, tenantId: string | null): boolean {
  if (control.hidden) return false
  return control.onlyFarms.length === 0 || (!!tenantId && control.onlyFarms.includes(tenantId))
}

/** One setting's value for one farm (tenantId null = Farm For You's own view). */
export function resolveSetting(key: SettingKey, layers: Layers, control: SettingControl = NO_CONTROL, tenantId: string | null = null): Resolved {
  const d = def(key)
  const platform = cleanValue(key, layers.platform)
  const usual = platform ?? d.default
  const offered = offeredTo(control, tenantId)
  const farmMayChange = !!tenantId && d.who !== "platform" && !control.locked && offered
  const userMayChange = farmMayChange && (d.who === "staff" || d.who === "customer")
  let value: AnyValue = usual
  let from: SettingSource = platform === undefined ? "default" : "platform"
  if (farmMayChange) {
    const farm = cleanValue(key, layers.farm)
    if (farm !== undefined) [value, from] = [farm, "farm"]
  }
  if (userMayChange) {
    const user = cleanValue(key, layers.user)
    if (user !== undefined) [value, from] = [user, "user"]
  }
  return { value, from, usual, farmMayChange, userMayChange, locked: control.locked, offered }
}

export type ResolvedSettings = { [K in SettingKey]: Resolved<SettingValue<K>> }

/** A saved value: whose it is (scope "platform", "farm" or "user") and for which setting. */
export interface StoredValue {
  scope: string
  key: string
  value: unknown
}

/** Every setting for one farm (and one person), from the saved values and Farm For You's controls. */
export function resolveAll(stored: StoredValue[], controls: Record<string, SettingControl>, tenantId: string | null): ResolvedSettings {
  const out = {} as Record<SettingKey, Resolved>
  for (const key of SETTING_KEYS) {
    const layers: Layers = {}
    for (const s of stored) if (s.key === key && (s.scope === "platform" || s.scope === "farm" || s.scope === "user")) layers[s.scope] = s.value
    out[key] = resolveSetting(key, layers, controls[key] ?? NO_CONTROL, tenantId)
  }
  return out as ResolvedSettings
}

/**
 * Whether a farm's Settings page shows the setting: one a farm may set, not hidden from it nor held back for other
 * farms, in a module it has, and its feature on. A locked one is still shown, read-only, so the farm knows its value.
 */
export function shownToFarm(key: SettingKey, r: Resolved, modules: readonly string[], features: Partial<Record<FeatureKey, boolean>>): boolean {
  const d = def(key)
  if (d.who === "platform" || !r.offered) return false
  if (!modules.includes(d.module)) return false
  return !d.feature || !!features[d.feature]
}

/** The settings of one module, grouped by heading, in registry order. */
export function groupsOf(module: ModuleKey, keys: readonly SettingKey[] = SETTING_KEYS): { group: SettingGroup; keys: SettingKey[] }[] {
  return SETTING_GROUPS.map((group) => ({ group, keys: keys.filter((k) => SETTINGS[k].module === module && SETTINGS[k].group === group) })).filter((g) => g.keys.length > 0)
}
