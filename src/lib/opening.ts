import type { InstalledApp } from "@/domain/app-hosts"

/**
 * How long each part of an opening lasts, in ms from when that part starts moving on screen.
 *   drawn: when its last piece has finished moving (a tap before this does nothing: the brand always registers);
 *   end:   when it gives way to the next part, or the app. Every part ends at the same time, so every app and every
 *          farm (with a mark that draws itself, or a logo that pops in) opens in the same time.
 * The shop and the farm app play FarmForYou's part, then the farm's; admin plays FarmForYou's alone.
 */
const PART_END = 3200

/**
 * Sounds, made in the browser (no files): soft and short, each on a moment of the animation (seconds from the part's
 * start, matching globals.css). On unless the person turned them off (SOUND_KEY), on the opening's own button or on
 * My account. Android plays them as an installed app opens; iPhone stays silent until the screen is touched.
 *   pop:   something pops into place;  thud: the egg lands;  blip: the comb pops;  chime: a smile.
 */
export type Cue = [number, "pop" | "thud" | "blip" | "chime"]
export const SOUND_KEY = "ffy-sound"

export const OPENING_PARTS = {
  // The heart pops up at 0.25s and smiles at 1.5s
  platform: { drawn: 2450, end: PART_END, cues: [[0.4, "pop"], [1.5, "chime"]] as Cue[] },
  // The Merry Egg lands at 0.4s, its comb pops at 1.15s, it smiles at 1.7s
  mark: { drawn: 2550, end: PART_END, cues: [[0.4, "thud"], [1.15, "blip"], [1.7, "chime"]] as Cue[] },
  // A farm's logo pops in at 0.45s; its name follows
  logo: { drawn: 1900, end: PART_END, cues: [[0.45, "pop"], [1.0, "chime"]] as Cue[] },
} as const

type Part = { drawn: number; end: number; cues: readonly Cue[] }

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
 *   - each part's sounds are played as it starts (unless turned off), and the opening's sound button turns them off
 *     or on, kept on this device. Its state is data-opening-sound="on" | "off" on <html>, for globals.css.
 * Plain ES5.
 */
export function openingScript(app: InstalledApp, parts: Part[]): string {
  const p = JSON.stringify(parts.map((x) => [x.drawn, x.end, x.cues]))
  return `try{(function(){var a="${app}",P=${p},k="ffy-opened-"+a,m=window.matchMedia;if(!(m("(display-mode: standalone)").matches||navigator.standalone===true)||m("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem(k))return;sessionStorage.setItem(k,"1");var r=document.documentElement,i=0,t=0,h=0,on=0,done=0,d=document,c=null,snd=1;try{snd=localStorage.getItem("${SOUND_KEY}")!=="off"}catch(e){}r.setAttribute("data-opening",a);r.setAttribute("data-opening-sound",snd?"on":"off");${SOUND_JS}function fin(){if(done)return;done=1;clearTimeout(h);r.setAttribute("data-opening-out","");setTimeout(function(){r.removeAttribute("data-opening");r.removeAttribute("data-opening-out");r.removeAttribute("data-opening-stage");r.removeAttribute("data-opening-sound");if(c)try{c.close()}catch(e){}},380)}function go(){clearTimeout(h);if(i>=P.length-1){fin();return}i++;t=Date.now();r.setAttribute("data-opening-stage",String(i+1));play(i);h=setTimeout(go,P[i][1])}function start(){if(on)return;on=1;t=Date.now();play(0);h=setTimeout(go,P[0][1])}d.addEventListener("animationstart",function(e){var n=e.target;if(n&&n.closest&&n.closest(".opening"))start()},true);d.addEventListener("DOMContentLoaded",function(){setTimeout(start,1500)});d.addEventListener("click",function(e){var n=e.target;if(!on||done||!n||!n.closest||!n.closest(".opening"))return;if(n.closest("[data-op-sound]")){toggle();return}if(Date.now()-t>=P[i][0])go()},true)})()}catch(e){}`
}

/**
 * The sound part of the opening script. play(i) plays part i's cues from now; toggle() turns sound off or on. Where
 * the phone held the sound back until a touch (iPhone), the first tap starts it instead of turning it off. Each sound is a short tone with a soft attack and a quick fade.
 */
const SOUND_JS = [
  `function ctx(){if(!c){var A=window.AudioContext||window.webkitAudioContext;if(!A)return null;c=new A()}if(c.state==="suspended")c.resume();return c}`,
  `function tone(x,f,at,dur,vol,type,f2){var o=x.createOscillator(),g=x.createGain();o.type=type||"sine";o.frequency.setValueAtTime(f,at);if(f2)o.frequency.exponentialRampToValueAtTime(f2,at+dur);g.gain.setValueAtTime(0.0001,at);g.gain.exponentialRampToValueAtTime(vol,at+0.015);g.gain.exponentialRampToValueAtTime(0.0001,at+dur);o.connect(g);g.connect(x.destination);o.start(at);o.stop(at+dur+0.05)}`,
  `function cue(x,kind,at){if(kind==="pop")tone(x,560,at,0.14,0.16,"sine",200);else if(kind==="thud"){tone(x,170,at,0.22,0.3,"sine",70);tone(x,620,at+0.02,0.1,0.08,"sine",260)}else if(kind==="blip")tone(x,900,at,0.1,0.1,"triangle",1350);else{tone(x,1047,at,0.7,0.09);tone(x,1568,at+0.1,0.8,0.07)}}`,
  `function play(n){if(!snd)return;var x=ctx();if(!x)return;var q=P[n][2],base=x.currentTime-(Date.now()-t)/1000;for(var j=0;j<q.length;j++){var at=base+q[j][0];if(at>=x.currentTime-0.05)cue(x,q[j][1],Math.max(at,x.currentTime))}}`,
  `function toggle(){if(snd&&c&&c.state!=="running"){c.resume();play(i);return}snd=!snd;try{localStorage.setItem("${SOUND_KEY}",snd?"on":"off")}catch(e){}r.setAttribute("data-opening-sound",snd?"on":"off");if(!snd){if(c)c.suspend()}else{ctx();play(i)}}`,
].join("")
