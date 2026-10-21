"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { saveFeatures } from "@/app/actions/billing"
import type { FeatureKey } from "@/domain/features"
import { cn } from "@/lib/utils"

export interface FeatureRow {
  key: FeatureKey
  on: boolean
  locked: "coming_soon" | "plan" | null
  /** Turned on by the farm but held off because a feature it needs is off. */
  blockedBy: FeatureKey | null
}

/** Owner turns farm features on and off. Each change saves at once. */
export function FeatureSwitches({ rows }: { rows: FeatureRow[] }) {
  const t = useTranslations("farm.features")
  const te = useTranslations("errors")
  const [state, setState] = useState(rows)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const toggle = (key: FeatureKey, on: boolean) => {
    setError(null)
    const previous = state
    setState(state.map((r) => (r.key === key ? { ...r, on } : r)))
    start(async () => {
      const r = await saveFeatures({ [key]: on })
      if (!r.ok) {
        setState(previous)
        setError(te.has(r.error) ? te(r.error) : te("generic"))
      }
    })
  }

  return (
    <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="mb-2 text-sm text-muted-foreground">{t("hint")}</p>
      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <ul className="divide-y">
        {state.map((r) => (
          <li key={r.key}>
            <label className={cn("flex items-start justify-between gap-4 py-3", r.locked && "opacity-60")}>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {t(`${r.key}.title`)}
                  {r.locked === "coming_soon" && <span className="rounded-full bg-yolk px-2 text-xs font-semibold text-yolk-foreground">{t("comingSoon")}</span>}
                  {r.locked === "plan" && <span className="rounded-full border px-2 text-xs">{t("needsPlan")}</span>}
                </span>
                <span className="block text-sm text-muted-foreground">{t(`${r.key}.hint`)}</span>
                {r.blockedBy && <span className="block text-sm text-destructive">{t("needs", { feature: t(`${r.blockedBy}.title`) })}</span>}
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked={r.on}
                className="mt-1 size-6 shrink-0 accent-[hsl(var(--primary))]"
                checked={r.on}
                disabled={!!r.locked || pending}
                onChange={(e) => toggle(r.key, e.target.checked)}
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
