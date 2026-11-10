"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Check } from "lucide-react"
import { giveDoseAction } from "@/app/actions/vaccinations"
import { useCheer } from "@/components/cheer"

/** One tap: this dose was given today, to every bird alive in the batch. Day, birds and cost can be changed on the batch. */
export function QuickGiveButton({ doseId, vaccine, today, birds }: { doseId: string; vaccine: string; today: string; birds: number }) {
  const t = useTranslations("farm.vaccines")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await giveDoseAction(doseId, { givenDate: today, birds, costRupees: null })
            if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
            else cheer("dose", { name: vaccine })
          })
        }
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sec-poultry text-base font-bold text-sec-on disabled:opacity-60"
      >
        <Check className="size-5" aria-hidden /> {pending ? t("saving") : t("givenToday")}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
