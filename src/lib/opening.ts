import type { InstalledApp } from "@/domain/app-hosts"
import { OPENING_SOUNDS_JS, SOUND_SETS } from "@/lib/opening-sounds"

/**
 * How long each part of an opening lasts, in ms from when that part starts moving on screen.
 *   drawn: when its last piece has finished moving (a tap before this does nothing: the brand always registers);
 *   end:   when it gives way to the next part, or the app. Every part ends at the same time, so every app and every
 *          farm (with a mark that draws itself, or a logo that pops in) opens in the same time.
 * The shop and the farm app play FarmForYou's part, then the farm's; admin plays FarmForYou's alone.
 */
const PART_END = 3200

/**
 * Sounds, made in the browser (no files): each part plays its own (src/lib/opening-sounds.ts), from one of three sets,
 * a different set each opening. On unless the person turned them off (SOUND_KEY), on the opening's own button or on
 * My account. Android plays them as an installed app opens; iPhone stays silent until the screen is touched.
 */
export const SOUND_KEY = "ffy-sound"
/** How many openings this device has played (the set is this count, in turn), so the next one plays the next set. */
export const SOUND_SET_KEY = "ffy-sound-set"

export type PartKind = "platform" | "mark" | "logo"
export const OPENING_PARTS = {
  // FarmForYou's heart: pops up at 0.25s, smiles at 1.5s
  platform: { drawn: 2450, end: PART_END, kind: "platform" },
  // The Merry Egg: lands at 0.4s, its comb pops at 1.15s, it smiles at 1.7s
  mark: { drawn: 2550, end: PART_END, kind: "mark" },
  // A farm's logo pops in at 0.4s; its name follows
  logo: { drawn: 1900, end: PART_END, kind: "logo" },
} as const

type Part = { drawn: number; end: number; kind: PartKind }

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
 *   - a tap skips only the hold after a part has finished moving;
 *   - each part's sounds are played as it starts (unless turned off), from the next of the sound sets in turn; the
 *     opening's sound button turns them off or on, kept on this device. Its state is data-opening-sound="on" | "off" on <html>, for globals.css.
 * Plain ES5.
 */
export function openingScript(app: InstalledApp, parts: Part[]): string {
  const p = JSON.stringify(parts.map((x) => [x.drawn, x.end, x.kind]))
  return `try{(function(){var a="${app}",P=${p},k="ffy-opened-"+a,m=window.matchMedia;if(!(m("(display-mode: standalone)").matches||navigator.standalone===true)||m("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");var r=document.documentElement,i=0,t=0,h=0,on=0,done=0,d=document,c=null,S=null,set=1,turn=1,snd=1;try{snd=localStorage.getItem("${SOUND_KEY}")!=="off";turn=(Number(localStorage.getItem("${SOUND_SET_KEY}"))||0)+1;if(!(turn<1e6))turn=1;set=turn%${SOUND_SETS};localStorage.setItem("${SOUND_SET_KEY}",String(turn))}catch(e){}r.setAttribute("data-opening",a);r.setAttribute("data-opening-sound",snd?"on":"off");${SOUND_JS}function fin(){if(done)return;done=1;clearTimeout(h);r.setAttribute("data-opening-out","");setTimeout(function(){r.removeAttribute("data-opening");r.removeAttribute("data-opening-out");r.removeAttribute("data-opening-stage");r.removeAttribute("data-opening-sound");if(c)try{c.close()}catch(e){}},380)}function go(){clearTimeout(h);if(i>=P.length-1){fin();return}i++;t=Date.now();r.setAttribute("data-opening-stage",String(i+1));play(i);h=setTimeout(go,P[i][1])}function start(){if(on)return;on=1;t=Date.now();play(0);h=setTimeout(go,P[0][1])}d.addEventListener("animationstart",function(e){var n=e.target;if(n&&n.closest&&n.closest(".opening"))start()},true);d.addEventListener("DOMContentLoaded",function(){setTimeout(start,1500)});d.addEventListener("click",function(e){var n=e.target;if(!on||done||!n||!n.closest||!n.closest(".opening"))return;if(n.closest("[data-op-sound]")){toggle();return}if(Date.now()-t>=P[i][0])go()},true)})()}catch(e){}`
}

/**
 * The sound part of the opening script. play(i) plays part i's sounds from where the part has got to; toggle() turns
 * sound off or on. Where the phone held the sound back until a touch (iPhone), the first tap starts it instead of
 * turning it off.
 */
const SOUND_JS = [
  OPENING_SOUNDS_JS.split("\n").join(""),
  `function ctx(){if(!c){var A=window.AudioContext||window.webkitAudioContext;if(!A)return null;c=new A();S=ffySounds(c)}if(c.state==="suspended")c.resume();return c}`,
  // Sound never holds up the opening: if a phone's audio fails, the opening plays on in silence
  `function play(n){if(!snd)return;try{var x=ctx();if(!x)return;S(set,P[n][2],x.currentTime-(Date.now()-t)/1000,x.currentTime,Math.floor(turn/${SOUND_SETS}))}catch(e){}}`,
  `function toggle(){if(snd&&c&&c.state!=="running"){c.resume();play(i);return}snd=!snd;try{localStorage.setItem("${SOUND_KEY}",snd?"on":"off")}catch(e){}r.setAttribute("data-opening-sound",snd?"on":"off");if(!snd){if(c)c.suspend()}else{ctx();play(i)}}`,
].join("")
