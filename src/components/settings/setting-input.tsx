"use client"

import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import type { AnyValue, SettingUnit } from "@/domain/settings"

/** What a setting row needs to draw itself (from the registry, so a new setting needs no new screen). */
export interface SettingRowDef {
  key: string
  type: "boolean" | "number" | "choice"
  min?: number
  max?: number
  step?: number
  unit?: SettingUnit
  choices?: readonly string[]
  shownWhen?: string
}

/** A value in words: On/Off, "4 hours", "₹1,500", or a choice's name. */
export function useShowValue() {
  const t = useTranslations("settings")
  return (def: SettingRowDef, v: AnyValue) => {
    if (def.type === "boolean") return v ? t("on") : t("off")
    if (def.type === "number") return def.unit === "rupees" ? `₹${Number(v).toLocaleString("en-IN")}` : `${Number(v).toLocaleString("en-IN")} ${t(`units.${def.unit}`)}`
    return t(`choices.${def.key}.${v}`)
  }
}

/** The input for one setting: a big tick box, a number with its unit, or a list of choices. */
export function SettingInput({ def, value, disabled, onChange, id }: { def: SettingRowDef; value: AnyValue; disabled?: boolean; onChange: (v: AnyValue) => void; id: string }) {
  const t = useTranslations("settings")
  if (def.type === "boolean")
    return <input id={id} type="checkbox" role="switch" aria-checked={!!value} className="mt-1 size-6 shrink-0 accent-primary" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
  if (def.type === "number")
    return (
      <span className="flex items-center gap-2">
        {def.unit === "rupees" && <span className="font-semibold">₹</span>}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={def.min}
          max={def.max}
          step={def.step}
          value={Number.isFinite(value as number) ? (value as number) : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          className="max-w-32"
        />
        {def.unit !== "rupees" && <span className="text-sm text-muted-foreground">{t(`units.${def.unit}`)}</span>}
      </span>
    )
  return (
    <select id={id} className="h-11 rounded-xl border bg-background px-3" value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {def.choices?.map((c) => (
        <option key={c} value={c}>
          {t(`choices.${def.key}.${c}`)}
        </option>
      ))}
    </select>
  )
}
