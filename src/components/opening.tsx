"use client"

import { useEffect } from "react"
import type { InstallApp } from "@/domain/install-apps"

type Ms = { drawn: number; total: number }

/**
 * The opening overlay for one app. It is always in the page but hidden; the <head> script (src/lib/opening.ts)
 * shows it by setting data-opening on <html> when the installed app has just been opened. It plays to the end, holds
 * the finished picture so the brand can be read, then fades (OPENING_MS); a tap after it has finished skips the hold.
 * With an `intro` (FarmForYou's part, before a farm's own), the intro plays first, then data-opening-stage="2" on
 * <html> swaps to the farm's part, whose animations start as it appears. Only <html>'s attributes change, so the page
 * itself is never re-drawn.
 */
export function Opening({
  app,
  ms,
  background,
  intro,
  children,
}: {
  app: InstallApp
  ms: Ms
  background: string
  intro?: { ms: Ms; background: string; content: React.ReactNode }
  children: React.ReactNode
}) {
  const introDrawn = intro?.ms.drawn
  const introTotal = intro?.ms.total
  useEffect(() => {
    const introMs = introDrawn !== undefined && introTotal !== undefined ? { drawn: introDrawn, total: introTotal } : null
    const root = document.documentElement
    if (root.getAttribute("data-opening") !== app) return
    let gone = false
    // When the last part started: page load for a single opening, the swap for a two-part one (null: not yet)
    let partStart: number | null = introMs ? null : 0
    let timer = 0
    const end = () => {
      if (gone) return
      gone = true
      root.setAttribute("data-opening-out", "")
      window.setTimeout(() => {
        root.removeAttribute("data-opening")
        root.removeAttribute("data-opening-out")
        root.removeAttribute("data-opening-stage")
      }, 380)
    }
    const toFarm = () => {
      if (partStart !== null) return
      partStart = performance.now()
      root.setAttribute("data-opening-stage", "2")
      window.clearTimeout(timer)
      timer = window.setTimeout(end, ms.total)
    }
    // Counted from when the page started loading, so a slow phone doesn't hold the opening longer
    timer = introMs ? window.setTimeout(toFarm, Math.max(300, introMs.total - performance.now())) : window.setTimeout(end, Math.max(300, ms.total - performance.now()))
    // A tap skips only a part's final hold: each animation always plays to the end, so the brand registers
    const tap = () => {
      const now = performance.now()
      if (partStart === null) {
        if (introMs && now >= introMs.drawn) toFarm()
      } else if (now - partStart >= ms.drawn) end()
    }
    const el = document.getElementById(`opening-${app}`)
    el?.addEventListener("click", tap)
    return () => {
      window.clearTimeout(timer)
      el?.removeEventListener("click", tap)
    }
  }, [app, ms.drawn, ms.total, introDrawn, introTotal])

  if (!intro) {
    return (
      <div id={`opening-${app}`} className="opening" data-app={app} style={{ background }} aria-hidden>
        {children}
      </div>
    )
  }
  return (
    <div id={`opening-${app}`} className="opening" data-app={app} style={{ background: intro.background }} aria-hidden>
      <div className="op-part op-part-intro" style={{ background: intro.background }}>
        {intro.content}
      </div>
      <div className="op-part op-part-farm" style={{ background }}>
        {children}
      </div>
    </div>
  )
}
