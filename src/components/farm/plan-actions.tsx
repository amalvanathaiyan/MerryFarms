"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { changePlanAction } from "@/app/actions/plans"
import type { PlanChange } from "@/server/plans"

export function PlanActions({
  planId,
  status,
  nextDate,
  nextLabel,
  skipDates,
}: {
  planId: string
  status: "active" | "paused" | "cancelled"
  nextDate: string | null
  nextLabel: string
  skipDates: { date: string; label: string }[]
}) {
  const t = useTranslations("farm.plans")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [pausing, setPausing] = useState(false)
  const [until, setUntil] = useState("")
  const [armedCancel, setArmedCancel] = useState(false)

  const run = (change: PlanChange) =>
    start(async () => {
      setError(null)
      const r = await changePlanAction({ planId, change })
      if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
      setPausing(false)
    })

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        {status === "active" && nextDate && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run({ kind: "skip", date: nextDate })}>
            {t("skipNext", { date: nextLabel })}
          </Button>
        )}
        {status === "active" ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setPausing(!pausing)}>
            {t("pause")}
          </Button>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => run({ kind: "resume" })}>
            {t("resume")}
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/farm/plans/${planId}`}>{t("edit")}</Link>
        </Button>
        <Button
          variant={armedCancel ? "destructive" : "ghost"}
          size="sm"
          className={armedCancel ? undefined : "text-destructive"}
          disabled={pending}
          onClick={() => (armedCancel ? run({ kind: "cancel" }) : setArmedCancel(true))}
        >
          {armedCancel ? t("confirmCancel") : t("cancel")}
        </Button>
      </div>
      {pausing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-2">
          <label className="flex items-center gap-2 text-sm">
            {t("pauseUntil")}
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-9 w-40" />
          </label>
          <Button size="sm" disabled={pending} onClick={() => run({ kind: "pause", until: until || null })}>
            {until ? t("pauseTill") : t("pauseOpen")}
          </Button>
        </div>
      )}
      {skipDates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("skipped")}:</span>
          {skipDates.map((s) => (
            <button key={s.date} type="button" disabled={pending} onClick={() => run({ kind: "unskip", date: s.date })} className="rounded-full border px-2.5 py-0.5" title={t("unskip")}>
              {s.label} ✕
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
