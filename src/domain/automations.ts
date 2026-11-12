/**
 * Automations (docs/platform-plan.md §5): ready-made recipes the platform ships. Their switches and numbers are
 * settings in the registry (src/domain/settings.ts: orderWaitingOn, orderYellowHours, lowStockOn, …), so Farm For
 * You sets the defaults, can lock or hide them, and each farm changes its own on its Settings page.
 * src/server/automation.ts runs them on every tick. Pure, so it is tested.
 */

/** The recipes, by the name their sent alerts are kept under (automation_notices.recipe). */
export const RECIPE_KEYS = ["orderWaiting", "lowStock", "trialEnding"] as const
export type RecipeKey = (typeof RECIPE_KEYS)[number]

/** The yellow and red marks for waiting orders; red never comes before yellow. */
export function waitMarks(yellowHours: number, redHours: number): { yellowHours: number; redHours: number } {
  return { yellowHours, redHours: Math.max(yellowHours, redHours) }
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
