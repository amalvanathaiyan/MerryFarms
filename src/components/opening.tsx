"use client"

import { useEffect } from "react"
import type { InstallApp } from "@/domain/install-apps"

/**
 * The opening overlay for one app. It is always in the page but hidden; the <head> script (src/lib/opening.ts)
 * shows it by setting data-opening on <html> when the installed app has just been opened. It plays to the end, holds
 * the finished picture so the brand can be read, then fades (OPENING_MS); a tap after it has finished skips the hold. Only <html>'s attributes change, so the page itself is never re-drawn.
 */
export function Opening({ app, ms, background, children }: { app: InstallApp; ms: { drawn: number; total: number }; background: string; children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    if (root.getAttribute("data-opening") !== app) return
    let gone = false
    const end = () => {
      if (gone) return
      gone = true
      root.setAttribute("data-opening-out", "")
      window.setTimeout(() => {
        root.removeAttribute("data-opening")
        root.removeAttribute("data-opening-out")
      }, 380)
    }
    // Counted from when the page started loading, so a slow phone doesn't hold the opening longer
    const timer = window.setTimeout(end, Math.max(300, ms.total - performance.now()))
    // A tap skips only the final hold: the animation itself always plays to the end, so the brand registers
    const tap = () => {
      if (performance.now() >= ms.drawn) end()
    }
    const el = document.getElementById(`opening-${app}`)
    el?.addEventListener("click", tap)
    return () => {
      window.clearTimeout(timer)
      el?.removeEventListener("click", tap)
    }
  }, [app, ms.drawn, ms.total])

  return (
    <div id={`opening-${app}`} className="opening" data-app={app} style={{ background }} aria-hidden>
      {children}
    </div>
  )
}
