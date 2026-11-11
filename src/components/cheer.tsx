"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  Bird,
  CalendarCheck,
  CheckCheck,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Egg,
  HandHeart,
  House,
  IndianRupee,
  Package,
  PhoneMissed,
  Receipt,
  Repeat,
  Scale,
  RotateCcw,
  SlidersHorizontal,
  Store,
  Syringe,
  Trash2,
  Truck,
  Undo2,
  UserRound,
  Wheat,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { chooseLine, toneOf, type CheerKind, type DayPart } from "@/domain/cheers"
import { greetingAt } from "@/domain/scenes"
import { istDate } from "@/domain/ist"
import { SECTION_LOOK, type SectionKey } from "@/lib/farm-sections"
import { cn } from "@/lib/utils"

/** Values for the fact line ("Loss noted · {batch} · {count} birds"). Amounts come already formatted. */
export type CheerValues = Record<string, string | number>

type Cheer = (kind: CheerKind, values?: CheerValues) => void
const CheerContext = createContext<Cheer>(() => {})

/** Tell the person their save worked: `const cheer = useCheer(); cheer("expense", { amount: "₹500" })`. */
export const useCheer = () => useContext(CheerContext)

const LOOK: Record<CheerKind, { icon: LucideIcon; section: SectionKey }> = {
  eggs: { icon: Egg, section: "poultry" },
  loss: { icon: HandHeart, section: "poultry" },
  day: { icon: ClipboardCheck, section: "poultry" },
  allDays: { icon: ClipboardCheck, section: "poultry" },
  batchAdded: { icon: Bird, section: "poultry" },
  batchSaved: { icon: Bird, section: "poultry" },
  batchClosed: { icon: Bird, section: "poultry" },
  dose: { icon: Syringe, section: "poultry" },
  doseUndone: { icon: Undo2, section: "poultry" },
  vaccinePlan: { icon: CalendarCheck, section: "poultry" },
  feed: { icon: Wheat, section: "poultry" },
  weight: { icon: Scale, section: "poultry" },
  expense: { icon: Receipt, section: "money" },
  made: { icon: Package, section: "money" },
  eggStore: { icon: Egg, section: "products" },
  payment: { icon: IndianRupee, section: "money" },
  orderNew: { icon: ClipboardList, section: "orders" },
  orderSaved: { icon: ClipboardList, section: "orders" },
  confirmed: { icon: CheckCheck, section: "orders" },
  packed: { icon: Package, section: "orders" },
  onTheWay: { icon: Truck, section: "orders" },
  delivered: { icon: House, section: "orders" },
  cancelled: { icon: XCircle, section: "orders" },
  called: { icon: PhoneMissed, section: "orders" },
  returned: { icon: RotateCcw, section: "orders" },
  product: { icon: Store, section: "products" },
  customer: { icon: UserRound, section: "customers" },
  slot: { icon: Clock, section: "slots" },
  plan: { icon: Repeat, section: "plans" },
  settings: { icon: SlidersHorizontal, section: "more" },
  video: { icon: Clapperboard, section: "more" },
  deleted: { icon: Trash2, section: "more" },
}

/** What this phone remembers: today's count (for milestones) and the lines shown lately (to avoid repeats). */
interface Memory {
  date: string
  count: number
  recent: Partial<Record<CheerKind, number[]>>
}
const KEY = "ffy-cheers"
function readMemory(today: string): Memory {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? "null") as Memory | null
    if (m && typeof m === "object") return m.date === today ? m : { date: today, count: 0, recent: m.recent ?? {} }
  } catch {}
  return { date: today, count: 0, recent: {} }
}
function writeMemory(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {}
}

interface Shown {
  id: number
  kind: CheerKind
  fact: string
  line: string
  milestone: boolean
  ms: number
}

/** Holds the notice for the farm app; any form below it can call useCheer(). */
export function CheerProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("cheers")
  const [shown, setShown] = useState<Shown | null>(null)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setShown(null)
  }, [])

  const cheer = useCallback<Cheer>(
    (kind, values = {}) => {
      const now = new Date()
      const memory = readMemory(istDate(now))
      memory.count += 1
      const lines = t.raw(`lines.${kind}`) as string[]
      const part: DayPart = greetingAt(now)
      const times = t.raw(`time.${part}`) as string[]
      const milestones = t.raw("milestone") as string[]
      const recent = memory.recent[kind] ?? []
      const pick = chooseLine({ kind, kindSize: lines.length, recent, timeSize: times.length, part, milestoneSize: milestones.length, countToday: memory.count, rand: Math.random })
      const line =
        pick.pool === "milestone" ? milestones[pick.index].replace("{count}", String(memory.count)) : pick.pool === "time" ? times[pick.index] : lines[pick.index]
      if (pick.pool === "kind") memory.recent[kind] = [...recent, pick.index].slice(-6)
      writeMemory(memory)

      let fact: string
      try {
        fact = t(`facts.${kind}`, values)
      } catch {
        fact = t("facts.settings")
      }
      // A blank value (a batch with no name) leaves no stray separator: "Batch added · " becomes "Batch added".
      fact = fact.replace(/( · )+(?= · |$)/g, "").trim()
      const milestone = pick.pool === "milestone"
      // Long enough to read the line (Tamil runs longer), never so long it gets in the way.
      const ms = Math.min(8000, 3800 + line.length * 45)
      seq.current += 1
      clearTimeout(timer.current)
      setShown({ id: seq.current, kind, fact, line, milestone, ms })
      timer.current = setTimeout(() => setShown(null), ms)
      if (milestone) {
        try {
          navigator.vibrate?.([18, 40, 18])
        } catch {}
      }
    },
    [t]
  )

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!shown) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shown, dismiss])

  const value = useMemo(() => cheer, [cheer])
  return (
    <CheerContext.Provider value={value}>
      {children}
      {/* Always in the page so screen readers announce each new notice. */}
      <div role="status" aria-live="polite" className="cheer-pos pointer-events-none fixed inset-x-3 z-50 mx-auto max-w-md print:hidden">
        {shown && <CheerCard key={shown.id} shown={shown} onClose={dismiss} closeLabel={t("close")} />}
      </div>
    </CheerContext.Provider>
  )
}

function CheerCard({ shown, onClose, closeLabel }: { shown: Shown; onClose: () => void; closeLabel: string }) {
  const tone = toneOf(shown.kind)
  const { icon: Icon, section } = LOOK[shown.kind]
  const look = SECTION_LOOK[section]
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={`${shown.fact}. ${shown.line}. ${closeLabel}`}
      className={cn("cheer-card pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-card p-3 pr-4 text-left shadow-lg", tone === "gentle" && "cheer-soft")}
    >
      <span className={cn("relative grid size-12 shrink-0 place-items-center rounded-full", tone === "gentle" ? "bg-muted text-foreground" : look.strong, tone !== "gentle" && "cheer-pop")}>
        <Icon className="size-6" aria-hidden />
        {shown.milestone && (
          <span className="cheer-sparks" aria-hidden>
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ "--a": `${i * 45}deg` } as React.CSSProperties} />
            ))}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base leading-snug font-bold break-words">{shown.fact}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{shown.line}</span>
      </span>
      <span className={cn("cheer-bar absolute bottom-0 left-0 h-1", tone === "gentle" ? "bg-muted-foreground/30" : look.strong)} style={{ animationDuration: `${shown.ms}ms` }} aria-hidden />
    </button>
  )
}
