"use client"

import { useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { Check, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"

type Note = { id: string; title: string; body: string | null; important: boolean }

const KEY = "ffy-notes-seen"
const CHANGED = "ffy-notes-change"

// The ids hidden on this phone, as a string so React sees the same value until it really changes.
const snapshot = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]"
  } catch {
    return "[]"
  }
}
const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener("storage", onChange)
  }
}
const parse = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

/**
 * Farm For You's announcements on the farm's Today page. "Got it" hides one on this phone (kept in the browser: a
 * convenience only; it ends on its own date anyway).
 */
export function FarmAnnouncements({ notes }: { notes: Note[] }) {
  const t = useTranslations("farm.announcements")
  const hidden = parse(useSyncExternalStore(subscribe, snapshot, () => "[]"))
  const shown = notes.filter((n) => !hidden.includes(n.id))
  if (!shown.length) return null
  const hide = (id: string) => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...new Set([...hidden, id])].slice(-50)))
    } catch {}
    window.dispatchEvent(new Event(CHANGED))
  }
  return (
    <ul className="flex flex-col gap-2" aria-label={t("label")}>
      {shown.map((n) => (
        <li key={n.id} className={cn("flex flex-col gap-2 rounded-2xl p-4", n.important ? "bg-destructive/10 text-destructive" : "bg-accent")}>
          <p className="flex items-start gap-2 font-semibold">
            <Megaphone className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <span className="block text-xs font-medium opacity-80">{t("from")}</span>
              {n.title}
            </span>
          </p>
          {n.body && <p className="text-sm whitespace-pre-line text-foreground">{n.body}</p>}
          <button type="button" onClick={() => hide(n.id)} className="flex min-h-11 items-center gap-1.5 self-start rounded-xl border bg-card px-3 text-sm font-semibold text-foreground hover:border-primary">
            <Check className="size-4" aria-hidden /> {t("gotIt")}
          </button>
        </li>
      ))}
    </ul>
  )
}
