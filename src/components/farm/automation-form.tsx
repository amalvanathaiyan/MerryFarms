"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveFarmRecipeAction, savePlatformRecipeAction } from "@/app/actions/automation"
import { RECIPES, type RecipeKey } from "@/domain/automations"
import { useCheer } from "@/components/cheer"

/**
 * One automation: what it does, its on/off and its numbers. For a farm (its own choice) or for Farm For You admin
 * (the default for every farm; off switches it off for all).
 */
export function AutomationForm({ recipe, enabled, params, lockedOff, who }: { recipe: RecipeKey; enabled: boolean; params: Record<string, number>; lockedOff: boolean; who: "farm" | "platform" }) {
  const t = useTranslations("automations")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const router = useRouter()
  const [on, setOn] = useState(enabled)
  const [p, setP] = useState(params)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      setError(null)
      const r = await (who === "farm" ? saveFarmRecipeAction : savePlatformRecipeAction)({ recipe, enabled: on, params: p })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      cheer("settings")
      router.refresh()
    })

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="text-lg font-bold">{t(`${recipe}.title`)}</h2>
        <p className="text-sm text-muted-foreground">{t(`${recipe}.hint`)}</p>
      </div>
      {lockedOff && who === "farm" ? (
        <p className="rounded-xl bg-muted p-3 text-sm">{t("lockedOff")}</p>
      ) : (
        <>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-primary" checked={on} onChange={(e) => setOn(e.target.checked)} />
            <span className="font-semibold">{t(who === "platform" ? "onForFarms" : "on")}</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(RECIPES[recipe].params).map(([name, def]) => (
              <label key={name} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">{t(`${recipe}.${name}`)}</span>
                <span className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={def.min}
                    max={def.max}
                    step={def.unit === "hours" ? 0.25 : 1}
                    value={p[name]}
                    disabled={!on}
                    onChange={(e) => setP({ ...p, [name]: Number(e.target.value) })}
                    className="max-w-32"
                  />
                  <span className="text-sm text-muted-foreground">{t(`unit_${def.unit}`)}</span>
                </span>
              </label>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" className="self-start" disabled={pending} onClick={save}>
            <Save /> {t("save")}
          </Button>
        </>
      )}
    </section>
  )
}
