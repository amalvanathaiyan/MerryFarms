/**
 * The opening animation plays when an installed app is opened from its home-screen icon: once per launch (the
 * session), never in a browser tab, and never for people who asked their phone for less motion.
 * Which app is opening comes from the address it opens at (the manifests' start_url): /admin, /farm, else the shop.
 * This runs in <head> before the page draws, so the page never flashes first: it sets data-opening="<app>" on
 * <html>, and globals.css shows that app's opening. src/components/opening.tsx takes it away when it ends. Plain ES5.
 */
export const OPENING_SCRIPT = `try{var p=location.pathname,a=p.indexOf("/admin")===0?"admin":p.indexOf("/farm")===0?"farm":"shop",k="ffy-opened-"+a,m=window.matchMedia;if((m("(display-mode: standalone)").matches||navigator.standalone===true)&&!m("(prefers-reduced-motion: reduce)").matches&&!sessionStorage.getItem(k)){sessionStorage.setItem(k,"1");document.documentElement.setAttribute("data-opening",a)}}catch(e){}`

/** How long each opening shows before it fades (ms). */
export const OPENING_MS = { platform: 2700, mark: 2800, logo: 2100 } as const
