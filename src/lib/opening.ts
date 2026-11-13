import type { InstalledApp } from "@/domain/app-hosts"

/**
 * The opening animation plays when an installed app is opened from its home-screen icon: once per launch (the
 * session), never in a browser tab, and never for people who asked their phone for less motion.
 * Which app is opening comes from the address and the page it opens at (openingApp in src/domain/app-hosts.ts, worked
 * out by the proxy), so the server draws only that app's opening.
 * This runs in <head> before the page draws, so the page never flashes first: it sets data-opening="<app>" on
 * <html>, and globals.css shows that app's opening. src/components/opening.tsx takes it away when it ends. Plain ES5.
 */
export function openingScript(app: InstalledApp): string {
  return `try{var a="${app}",k="ffy-opened-"+a,m=window.matchMedia;if((m("(display-mode: standalone)").matches||navigator.standalone===true)&&!m("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");document.documentElement.setAttribute("data-opening",a)}}catch(e){}`
}

/**
 * Each opening plays to the end, then the finished picture holds about a second and a half, long enough to take in the
 * mark and read the farm's name, before the app appears (the user, 2026-11-12: the brand must register every time).
 *   drawn: when the last part has finished moving (ms after the page began loading);
 *   total: when the opening fades. A tap only skips the hold, never the animation.
 * The shop and the farm app play FarmForYou's opening first (intro), then the farm's own; the farm's part is then
 * timed from when it starts.
 */
export const OPENING_MS = {
  platform: { drawn: 2450, total: 3900 },
  mark: { drawn: 2550, total: 4000 },
  logo: { drawn: 1900, total: 3300 },
  /** FarmForYou's part before a farm's own opening (shop and farm app): a shorter hold, as the farm's part follows. */
  intro: { drawn: 2450, total: 3000 },
} as const
