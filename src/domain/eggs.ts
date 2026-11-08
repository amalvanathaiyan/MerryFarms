/**
 * The farm's egg store: one count of loose eggs shared by every egg product. Pure.
 */

/** Whole units (trays, packs) that can be packed from the store; the eggs left over stay loose. */
export const unitsFromEggs = (eggs: number, eggsPerUnit: number) => (eggsPerUnit > 0 ? Math.floor(Math.max(0, eggs) / eggsPerUnit) : 0)

/** Good eggs from a day's entry: collected less broken (never below zero). */
export const goodEggs = (d: { eggsCollected: number | null; eggsBroken: number | null } | null | undefined) => (d ? Math.max(0, (d.eggsCollected ?? 0) - (d.eggsBroken ?? 0)) : 0)

/** How many eggs a saved day adds to the store: the change in its good eggs (a correction can take some back). */
export const eggsChange = (before: { eggsCollected: number | null; eggsBroken: number | null } | null | undefined, after: { eggsCollected: number | null; eggsBroken: number | null }) =>
  goodEggs(after) - goodEggs(before)

/** "In one" choices offered for egg products: common Indian pack sizes; any other number can be typed. */
export const COMMON_EGG_PACKS = [6, 10, 12, 30] as const
