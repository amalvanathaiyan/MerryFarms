/**
 * The opening animation plays when an installed app is opened from its home-screen icon: once per launch (the
 * session), never in a browser tab, and never for people who asked their phone for less motion.
 * Which app is opening comes from the address it opens at (the manifests' start_url): /admin, /farm, else the shop.
 * This runs in <head> before the page draws, so the page never flashes first: it sets data-opening="<app>" on
 * <html>, and globals.css shows that app's opening. src/components/opening.tsx takes it away when it ends. Plain ES5.
 */
export const OPENING_SCRIPT = `try{var p=location.pathname,a=p.indexOf("/admin")===0?"admin":p.indexOf("/farm")===0?"farm":"shop",k="ffy-opened-"+a,m=window.matchMedia;if((m("(display-mode: standalone)").matches||navigator.standalone===true)&&!m("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");document.documentElement.setAttribute("data-opening",a)}}catch(e){}`

/**
 * Each opening plays to the end, then the finished picture holds about a second and a half, long enough to take in the
 * mark and read the farm's name, before the app appears (the user, 2026-11-12: the brand must register every time).
 *   drawn: when the last part has finished moving (ms after the page began loading);
 *   total: when the opening fades. A tap only skips the hold, never the animation.
 */
export const OPENING_MS = {
  platform: { drawn: 2450, total: 3900 },
  mark: { drawn: 2550, total: 4000 },
  logo: { drawn: 1900, total: 3300 },
} as const
