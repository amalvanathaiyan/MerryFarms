"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Keeps a page's server data fresh without a reload: every `seconds` while the page is on screen, and at once
 * when the person comes back to it (another app, a locked phone). Hidden pages don't refresh, to save data.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh()
    }
    const id = setInterval(refresh, seconds * 1000)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [router, seconds])
  return null
}
