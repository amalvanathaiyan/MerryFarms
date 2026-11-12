"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { savePlatformSettingAction } from "@/app/actions/settings"
import type { AnyValue, SettingControl } from "@/domain/settings"
import { SettingInput, useShowValue, type SettingRowDef } from "./setting-input"

export interface AdminSettingRowProps {
  def: SettingRowDef & { default: AnyValue; platformOnly: boolean }
  /** Farm For You's saved value (null = the default) */
  platformValue: AnyValue | null
  control: SettingControl
  farmsOwn: number
  farms: { id: string; name: string }[]
}

/**
 * One setting in Farm For You admin: the value every farm gets, and whether it is locked, hidden from farms or
 * offered only to chosen farms first. Platform-only settings have just the value.
 */
export function AdminSettingRow({ def, platformValue, control, farmsOwn, farms }: AdminSettingRowProps) {
  const t = useTranslations("settings")
  const ta = useTranslations("settings.admin")
  const te = useTranslations("errors")
  const show = useShowValue()
  const router = useRouter()
  const [value, setValue] = useState<AnyValue>(platformValue ?? def.default)
  const [locked, setLocked] = useState(control.locked)
  const [hidden, setHidden] = useState(control.hidden)
  const [firstFarms, setFirstFarms] = useState(control.onlyFarms.length > 0)
  const [only, setOnly] = useState<string[]>(control.onlyFarms)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const id = `admin-setting-${def.key}`

  const save = (useDefault = false) =>
    start(async () => {
      setMsg(null)
      const r = await savePlatformSettingAction({
        key: def.key,
        value: useDefault ? null : value,
        control: { locked, hidden, onlyFarms: firstFarms ? only : [] },
      })
      if (!r.ok) return setMsg({ ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      if (useDefault) setValue(def.default)
      setMsg({ ok: true, text: ta("saved") })
      router.refresh()
    })

  const invalid = def.type === "number" && !Number.isFinite(value as number)

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className={def.type === "boolean" ? "flex items-start justify-between gap-4" : "flex flex-col gap-1.5"}>
        <label htmlFor={id} className="min-w-0">
          <span className="block font-semibold">{t(`${def.key}.label`)}</span>
          {t.has(`${def.key}.hint`) && <span className="block text-sm text-muted-foreground">{t(`${def.key}.hint`)}</span>}
        </label>
        <SettingInput id={id} def={def} value={value} disabled={pending} onChange={setValue} />
      </div>
      <p className="text-sm text-muted-foreground">
        {ta("default", { value: show(def, def.default) })}
        {platformValue !== null && platformValue !== def.default && (
          <>
            {" · "}
            <button type="button" className="min-h-9 font-semibold text-primary underline-offset-4 hover:underline" disabled={pending} onClick={() => save(true)}>
              {ta("backToDefault")}
            </button>
          </>
        )}
        {!def.platformOnly && <> · {ta("farmsOwn", { count: farmsOwn })}</>}
      </p>
      {def.platformOnly ? (
        <p className="text-sm text-muted-foreground">{ta("platformOnly")}</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-5 accent-primary" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
            <span>
              <b>{ta("locked")}</b> {ta("lockedHint")}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-5 accent-primary" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            <span>
              <b>{ta("hidden")}</b> {ta("hiddenHint")}
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-5 accent-primary" checked={firstFarms} onChange={(e) => setFirstFarms(e.target.checked)} />
            <span>
              <b>{ta("firstFarms")}</b> {ta("firstFarmsHint")}
            </span>
          </label>
          {firstFarms && (
            <ul className="ml-8 flex flex-col gap-1">
              {farms.map((f) => (
                <li key={f.id}>
                  <label className="flex min-h-9 items-center gap-2">
                    <input type="checkbox" className="size-5 accent-primary" checked={only.includes(f.id)} onChange={(e) => setOnly(e.target.checked ? [...only, f.id] : only.filter((x) => x !== f.id))} />
                    {f.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || invalid} onClick={() => save()}>
          <Save /> {t("save")}
        </Button>
        {msg && (
          <span role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm font-semibold text-primary" : "text-sm font-semibold text-destructive"}>
            {msg.text}
          </span>
        )}
      </div>
    </li>
  )
}
