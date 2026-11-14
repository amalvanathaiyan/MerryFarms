import type { InstalledApp } from "@/domain/app-hosts"

/**
 * How long each part of an opening lasts, in ms from when that part starts moving on screen.
 *   drawn: when its last piece has finished moving (a tap before this does nothing: the brand always registers);
 *   end:   when it gives way to the next part, or the app. Every part ends at the same time, so every app and every
 *          farm (with a mark that draws itself, or a logo that pops in) opens in the same time.
 * The shop and the farm app play FarmForYou's part, then the farm's; admin plays FarmForYou's alone.
 */
const PART_END = 3200
export const OPENING_PARTS = {
  platform: { drawn: 2450, end: PART_END },
  mark: { drawn: 2550, end: PART_END },
  logo: { drawn: 1900, end: PART_END },
} as const

type Part = { drawn: number; end: number }

/** The parts an app's opening plays, in order. */
export function openingParts(app: InstalledApp, farm: { hasMark: boolean } | null): Part[] {
  if (app === "admin" || !farm) return [OPENING_PARTS.platform]
  return [OPENING_PARTS.platform, farm.hasMark ? OPENING_PARTS.mark : OPENING_PARTS.logo]
}

/**
 * The opening plays when an installed app is opened from its home-screen icon: once per launch (the session), never
 * in a browser tab, and never for people who asked their phone for less motion. Which app is opening comes from the
 * address and the page (openingApp in src/domain/app-hosts.ts, worked out by the proxy); the server draws only that
 * app's opening (src/components/openings.tsx).
 *
 * This runs in <head> before the page draws, so the page never flashes first, and it runs the whole opening itself,
 * not waiting for the app's code to load, so it is timed the same on every launch and every phone:
 *   - it sets data-opening="<app>" on <html>, and globals.css shows that app's opening;
 *   - the clock starts when the opening's first animation actually starts on screen (not when the page began loading,
 *     which on a slow launch would cut the animation short);
 *   - each part gives way at its `end`: data-opening-stage="2" swaps to the farm's part, then data-opening-out fades
 *     the opening away;
 *   - a tap skips only the hold after a part has finished moving.
 * Plain ES5.
 */
export function openingScript(app: InstalledApp, parts: Part[]): string {
  const p = JSON.stringify(parts.map((x) => [x.drawn, x.end]))
  return `try{(function(){var a="${app}",P=${p},k="ffy-opened-"+a,m=window.matchMedia;if(!(m("(display-mode: standalone)").matches||navigator.standalone===true)||m("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");var r=document.documentElement,i=0,t=0,h=0,on=0,done=0,d=document;r.setAttribute("data-opening",a);function fin(){if(done)return;done=1;clearTimeout(h);r.setAttribute("data-opening-out","");setTimeout(function(){r.removeAttribute("data-opening");r.removeAttribute("data-opening-out");r.removeAttribute("data-opening-stage")},380)}function go(){clearTimeout(h);if(i>=P.length-1){fin();return}i++;t=Date.now();r.setAttribute("data-opening-stage",String(i+1));h=setTimeout(go,P[i][1])}function start(){if(on)return;on=1;t=Date.now();h=setTimeout(go,P[0][1])}d.addEventListener("animationstart",function(e){var n=e.target;if(n&&n.closest&&n.closest(".opening"))start()},true);d.addEventListener("DOMContentLoaded",function(){setTimeout(start,1500)});d.addEventListener("click",function(e){var n=e.target;if(on&&!done&&n&&n.closest&&n.closest(".opening")&&Date.now()-t>=P[i][0])go()},true)})()}catch(e){}`
}
