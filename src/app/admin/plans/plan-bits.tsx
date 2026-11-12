"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createStarterPlansAction } from "@/app/actions/platform-plans"

/** Makes the four starting plans from the old fixed levels, so farms moved onto them get exactly what they have now. */
export function StarterPlansButton() {
  const t = useTranslations("admin.plans")
  const te = useTranslations("errors")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        className="self-start"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createStarterPlansAction()
            if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
            router.refresh()
          })
        }
      >
        <Sparkles /> {t("makeStarter")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
