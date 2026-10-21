"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCustomer } from "@/app/actions/billing"
import { LOCALE_LABELS } from "@/i18n/routing"

type Customer = {
  id: string
  name: string
  language: "ta" | "en"
  isTrusted: boolean
  creditLimitRupees: number
  marketingOptIn: boolean
  notes: string
}

export function CustomerEditor({ customer, canEdit, showCredit, showTrusted }: { customer: Customer; canEdit: boolean; showCredit: boolean; showTrusted: boolean }) {
  const t = useTranslations("farm.customers")
  const te = useTranslations("errors")
  const [c, setC] = useState(customer)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()
  const set = <K extends keyof Customer>(k: K, v: Customer[K]) => (setSaved(false), setC({ ...c, [k]: v }))

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await updateCustomer({ ...c, notes: c.notes || undefined })
          if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
          else setSaved(true)
        })
      }}
    >
      <h2 className="text-lg font-semibold">{t("profile")}</h2>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("name")}
          <Input required value={c.name} onChange={(e) => set("name", e.target.value)} className="h-11 font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("language")}
          <select value={c.language} onChange={(e) => set("language", e.target.value as Customer["language"])} className="h-11 rounded-md border border-input bg-transparent px-3 font-normal">
            {(["ta", "en"] as const).map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        {showTrusted && <Toggle label={t("trustedLabel")} hint={t("trustedHint")} checked={c.isTrusted} onChange={(v) => set("isTrusted", v)} />}
        {showCredit && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("creditLimit")}
          <Input type="number" min={0} step="50" inputMode="numeric" value={c.creditLimitRupees} onChange={(e) => set("creditLimitRupees", Number(e.target.value))} className="h-11 font-normal" />
          <span className="font-normal text-muted-foreground">{t("creditLimitHint")}</span>
        </label>
        )}
        <Toggle label={t("optIn")} hint={t("optInHint")} checked={c.marketingOptIn} onChange={(v) => set("marketingOptIn", v)} />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("notes")}
          <textarea rows={3} value={c.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("notesHint")} className="rounded-md border border-input bg-transparent px-3 py-2 font-normal" />
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {saved ? t("saved") : t("save")}
        </Button>
      )}
    </form>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-sm text-muted-foreground">{hint}</span>
      </span>
      <input type="checkbox" className="mt-1 size-6 shrink-0 accent-[hsl(var(--primary))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
