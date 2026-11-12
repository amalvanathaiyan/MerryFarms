/**
 * Automations (docs/platform-plan.md §5): ready-made recipes the platform ships. Each has an on/off and a few numbers.
 * The platform sets defaults (and can switch a recipe off for every farm); each farm switches its own on or off and
 * changes the numbers. src/server/automation.ts runs them on every tick. Pure, so it is tested.
 */
import type { ModuleKey } from "./modules"

export const RECIPE_KEYS = ["orderWaiting", "lowStock", "trialEnding"] as const
export type RecipeKey = (typeof RECIPE_KEYS)[number]

export interface ParamDef {
  default: number
  min: number
  max: number
  /** Shown beside the number box */
  unit: "hours" | "days" | "units"
}

export interface RecipeDef {
  /** farm: each farm switches it and sets its numbers; platform: only Farm For You admin does */
  scope: "farm" | "platform"
  /** The module a farm needs for it (none for platform recipes) */
  module: ModuleKey | null
  defaultOn: boolean
  params: Record<string, ParamDef>
}

export const RECIPES: Record<RecipeKey, RecipeDef> = {
  // An order still waiting to be confirmed turns yellow, then red; staff are told once when it turns red.
  orderWaiting: {
    scope: "farm",
    module: "selling",
    defaultOn: true,
    params: { yellowHours: { default: 2, min: 0.25, max: 72, unit: "hours" }, redHours: { default: 4, min: 0.5, max: 96, unit: "hours" } },
  },
  // A product down to this many: the packing staff and owner are told, at most once a day for each product.
  lowStock: { scope: "farm", module: "selling", defaultOn: true, params: { atOrBelow: { default: 5, min: 0, max: 100_000, unit: "units" } } },
  // The farm's owner is reminded this many days before its free trial ends.
  trialEnding: { scope: "platform", module: null, defaultOn: true, params: { daysBefore: { default: 3, min: 1, max: 30, unit: "days" } } },
}

export const isRecipeKey = (k: unknown): k is RecipeKey => typeof k === "string" && (RECIPE_KEYS as readonly string[]).includes(k)

export type RecipeSetting = { enabled: boolean; params: Record<string, number> }

/** Keeps only the recipe's own numbers, each within its limits. */
export function cleanParams(key: RecipeKey, json: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!json || typeof json !== "object" || Array.isArray(json)) return out
  for (const [name, def] of Object.entries(RECIPES[key].params)) {
    const v = (json as Record<string, unknown>)[name]
    if (typeof v === "number" && Number.isFinite(v)) out[name] = Math.min(def.max, Math.max(def.min, v))
  }
  return out
}

/**
 * What applies to one farm: the platform's switch wins when it is off (switched off for everyone); otherwise the
 * farm's own choice, then the platform default, then the recipe's. Numbers: the farm's, else the platform's, else
 * the recipe's.
 */
export function resolveRecipe(
  key: RecipeKey,
  platform: { enabled: boolean; params: unknown } | null,
  farm: { enabled: boolean; params: unknown } | null,
): RecipeSetting & { lockedOff: boolean } {
  const def = RECIPES[key]
  const lockedOff = platform?.enabled === false
  const params: Record<string, number> = {}
  for (const [name, p] of Object.entries(def.params)) params[name] = p.default
  Object.assign(params, cleanParams(key, platform?.params), def.scope === "farm" ? cleanParams(key, farm?.params) : {})
  // Red never comes before yellow
  if (key === "orderWaiting" && params.redHours < params.yellowHours) params.redHours = params.yellowHours
  const enabled = !lockedOff && (def.scope === "farm" && farm ? farm.enabled : (platform?.enabled ?? def.defaultOn))
  return { enabled, params, lockedOff }
}

export type WaitLevel = "green" | "yellow" | "red"

/** How long an order has waited to be confirmed, as a colour: green, then yellow, then red. */
export function waitLevel(createdAt: Date, now: Date, p: { yellowHours: number; redHours: number }): WaitLevel {
  const hours = (now.getTime() - createdAt.getTime()) / 3_600_000
  if (hours >= p.redHours) return "red"
  if (hours >= p.yellowHours) return "yellow"
  return "green"
}

/** "2 h 15 min", "45 min": how long it has waited, for beside the colour (never colour alone). */
export function waitedFor(createdAt: Date, now: Date): { hours: number; minutes: number } {
  const total = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 60_000))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}
