/**
 * Farm For You's modules: the building blocks a farm takes (docs/platform-plan.md §3.1, §3.5).
 *
 * A module is what a farm subscribes to; features are switches inside one module (src/domain/features.ts), so
 * modules never overlap. Farm Core is always on. The platform admin builds plans from modules in admin; nothing
 * about a plan is fixed in code. A module not built yet shows as "coming soon".
 *
 * Adding a module: add it here and to MODULE_KEYS, add its Tamil/English name under modules in messages/*.json,
 * give its features `module: "<key>"` in features.ts.
 */
export const MODULE_KEYS = ["core", "selling", "buying", "poultry", "livestock", "fishery", "crops"] as const
export type ModuleKey = (typeof MODULE_KEYS)[number]

export interface ModuleDef {
  /** Every farm has it, whatever its plan. */
  alwaysOn: boolean
  /** Built and usable today; false shows it as "coming soon". */
  available: boolean
  /** Other modules it needs (e.g. Buying fills Farm Core's inputs store). */
  requires: ModuleKey[]
  /** Short icon name (lucide) for lists. */
  icon: string
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  core: { alwaysOn: true, available: true, requires: [], icon: "tractor" },
  selling: { alwaysOn: false, available: true, requires: [], icon: "store" },
  buying: { alwaysOn: false, available: false, requires: [], icon: "truck" },
  poultry: { alwaysOn: false, available: true, requires: [], icon: "egg" },
  livestock: { alwaysOn: false, available: false, requires: [], icon: "milk" },
  fishery: { alwaysOn: false, available: false, requires: [], icon: "fish" },
  crops: { alwaysOn: false, available: false, requires: [], icon: "sprout" },
}

export const isModuleKey = (k: unknown): k is ModuleKey => typeof k === "string" && (MODULE_KEYS as readonly string[]).includes(k)

/** Limits a plan can set; a missing limit means no limit. */
export const LIMIT_KEYS = ["products", "staff", "ordersPerMonth", "videoSpaceMb"] as const
export type LimitKey = (typeof LIMIT_KEYS)[number]
export type Limits = Partial<Record<LimitKey, number>>
