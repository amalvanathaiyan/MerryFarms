/**
 * Which farm picture to show, and in what light. Farms with "Poultry farm pictures" on get their own live
 * scenes (the farm gate, the shop stall, a hen with her eggs) taking turns day by day with FarmForYou's bullock
 * cart; the sky follows the time of day in India. Other farms keep the cart. Pure, so it is tested.
 */
import { daysBetween, istDate } from "./ist"

export type ScenePhase = "dawn" | "day" | "evening" | "night"
export type SceneKind = "gate" | "stall" | "hen" | "cart"
/** A wide welcome picture, or a small one (order placed, empty pages). */
export type SceneSpot = "hero" | "small"

/** Minutes after midnight in India (UTC+5:30, no daylight saving). */
const istMinutes = (at: Date) => (at.getUTCHours() * 60 + at.getUTCMinutes() + 330) % 1440

/**
 * The light in Tamil Nadu, where the sun rises around 6 and sets around 6 all year:
 * dawn 5:30–7:30, day until 5 pm, evening until 6:45 pm, then night.
 */
export function phaseAt(at: Date): ScenePhase {
  const m = istMinutes(at)
  if (m >= 330 && m < 450) return "dawn"
  if (m >= 450 && m < 1020) return "day"
  if (m >= 1020 && m < 1125) return "evening"
  return "night"
}

/**
 * All the pictures take turns, one a day, and keep it all day long (each draws its own dawn, day, evening and
 * night). Welcome: the farm gate, the farm shop, the bullock cart. Small spots: the hen with her eggs, the cart.
 */
const HERO: SceneKind[] = ["gate", "stall", "cart"]
const SMALL: SceneKind[] = ["hen", "cart"]

export function sceneFor(opts: { farmScenes: boolean; spot: SceneSpot; at: Date }): SceneKind {
  if (!opts.farmScenes) return "cart"
  const list = opts.spot === "small" ? SMALL : HERO
  const day = daysBetween("2026-01-01", istDate(opts.at))
  return list[((day % list.length) + list.length) % list.length]
}

/** How long until the light changes, so an open page can redraw the sky then (at most an hour). */
export function msToNextPhase(at: Date): number {
  const m = istMinutes(at)
  const next = [330, 450, 1020, 1125, 330 + 1440].find((b) => b > m)!
  const ms = (next - m) * 60_000 - at.getUTCSeconds() * 1000 - at.getUTCMilliseconds()
  return Math.max(1000, Math.min(ms, 3_600_000))
}

export type Greeting = "morning" | "afternoon" | "evening" | "night"

/** A hello for the hour in India: morning from 4, afternoon from noon, evening from 5 pm, night from 9 pm. */
export function greetingAt(at: Date): Greeting {
  const h = Math.floor(istMinutes(at) / 60)
  if (h >= 4 && h < 12) return "morning"
  if (h >= 12 && h < 17) return "afternoon"
  if (h >= 17 && h < 21) return "evening"
  return "night"
}
