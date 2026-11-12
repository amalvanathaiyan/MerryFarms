"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Lock, RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveFarmSettingsAction } from "@/app/actions/settings"
import type { AnyValue, SettingSource } from "@/domain/settings"
import { useCheer } from "@/components/cheer"
import { SettingInput, useShowValue, type SettingRowDef } from "./setting-input"

export interface FarmSettingRow extends SettingRowDef {
  value: AnyValue
  usual: AnyValue
  from: SettingSource
  /** Locked by Farm For You: shown, not changeable. */
  locked: boolean
}

/**
 * One heading's settings on the farm's Settings page (e.g. Confirmation calls), drawn from the registry.
 * Change any, then Save; a setting the farm set itself can go back to the usual.
 */
export function SettingsGroupForm({ group, rows }: { group: string; rows: FarmSettingRow[] }) {
  const t = useTranslations("settings")
  const te = useTranslations("errors")
  const show = useShowValue()
  const cheer = useCheer()
  const router = useRouter()
  const [values, setValues] = useState<Record<string, AnyValue>>(() => Object.fromEntries(rows.map((r) => [r.key, r.value])))
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const save = (changes: Record<string, AnyValue | null>) =>
    start(async () => {
      setError(null)
      if (!Object.keys(changes).length) return
      const r = await saveFarmSettingsAction(changes)
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      cheer("settings")
      router.refresh()
    })

  const changed = Object.fromEntries(rows.filter((r) => !r.locked && values[r.key] !== r.value).map((r) => [r.key, values[r.key]]))
  const invalid = rows.some((r) => r.type === "number" && !Number.isFinite(values[r.key] as number))

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div>
        <h3 className="text-lg font-bold">{t(`groups.${group}.title`)}</h3>
        {t.has(`groups.${group}.hint`) && <p className="text-sm text-muted-foreground">{t(`groups.${group}.hint`)}</p>}
      </div>
      <ul className="flex flex-col divide-y">
        {rows.map((r) => {
          const parentOff = !!r.shownWhen && values[r.shownWhen] === false
          const id = `setting-${r.key}`
          return (
            <li key={r.key} className={parentOff ? "py-3 opacity-60" : "py-3"}>
              <div className={r.type === "boolean" ? "flex items-start justify-between gap-4" : "flex flex-col gap-1.5"}>
                <label htmlFor={id} className="min-w-0">
                  <span className="block font-semibold">{t(`${r.key}.label`)}</span>
                  {t.has(`${r.key}.hint`) && <span className="block text-sm text-muted-foreground">{t(`${r.key}.hint`)}</span>}
                </label>
                {r.locked ? (
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Lock className="size-4" aria-hidden /> {show(r, r.value)}
                  </span>
                ) : (
                  <SettingInput id={id} def={r} value={values[r.key]} disabled={pending || parentOff} onChange={(v) => setValues({ ...values, [r.key]: v })} />
                )}
              </div>
              {r.locked && <p className="mt-1 text-sm text-muted-foreground">{t("setByFfy")}</p>}
              {!r.locked && r.from === "farm" && r.value !== r.usual && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  {t("usualIs", { value: show(r, r.usual) })}
                  <button type="button" className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline" disabled={pending} onClick={() => save({ [r.key]: null })}>
                    <RotateCcw className="size-4" aria-hidden /> {t("useUsual")}
                  </button>
                </p>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {rows.some((r) => !r.locked) && (
        <Button type="button" className="self-start" disabled={pending || invalid || !Object.keys(changed).length} onClick={() => save(changed)}>
          <Save /> {t("save")}
        </Button>
      )}
    </section>
  )
}
