"use client"

import { useEffect } from "react"

/**
 * Keeps --app-header-h on <html> equal to the app header's real height (it grows with a long Tamil farm name or
 * larger text), so bars pinned under it sit exactly below it.
 */
export function HeaderHeight({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id)
    if (!el) return
    const set = () => document.documentElement.style.setProperty("--app-header-h", `${Math.ceil(el.getBoundingClientRect().height)}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [id])
  return null
}
