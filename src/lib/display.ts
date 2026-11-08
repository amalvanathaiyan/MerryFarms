/**
 * Display choices for eyes that need them, kept on each device (localStorage), not on the account: the same person
 * may want soft colours on a bright phone outdoors and not on a desk computer.
 *   theme: "auto" follows the phone, or "light" / "dark";
 *   soft:  calmer, less saturated colours;
 *   text:  "large" makes every size a step bigger.
 * Applied as data-theme / data-soft / data-text on <html>; the colours are in globals.css.
 */
export type Display = { theme: "auto" | "light" | "dark"; soft: boolean; text: "normal" | "large" }

export const DISPLAY_KEY = "ffy-display"
export const DEFAULT_DISPLAY: Display = { theme: "auto", soft: false, text: "normal" }

/** Runs in <head> before the page draws, so a chosen look never flashes the default first. Plain ES5. */
export const DISPLAY_SCRIPT = `try{var d=JSON.parse(localStorage.getItem("${DISPLAY_KEY}")||"{}"),r=document.documentElement;if(d.theme==="light"||d.theme==="dark")r.setAttribute("data-theme",d.theme);if(d.soft===true)r.setAttribute("data-soft","on");if(d.text==="large")r.setAttribute("data-text","large")}catch(e){}`

export function readDisplay(): Display {
  try {
    const d = JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}")
    return {
      theme: d.theme === "light" || d.theme === "dark" ? d.theme : "auto",
      soft: d.soft === true,
      text: d.text === "large" ? "large" : "normal",
    }
  } catch {
    return DEFAULT_DISPLAY
  }
}

/** Saves the choice on this device and shows it at once. */
export function applyDisplay(d: Display) {
  const r = document.documentElement
  if (d.theme === "auto") r.removeAttribute("data-theme")
  else r.setAttribute("data-theme", d.theme)
  if (d.soft) r.setAttribute("data-soft", "on")
  else r.removeAttribute("data-soft")
  if (d.text === "large") r.setAttribute("data-text", "large")
  else r.removeAttribute("data-text")
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(d))
  } catch {
    // Private mode or blocked storage: the look still changes for this visit.
  }
}
