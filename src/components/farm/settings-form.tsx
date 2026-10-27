"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveFarmSettings } from "@/app/actions/billing"

type Settings = {
  nameTa: string
  nameEn: string
  phone: string
  whatsappNumber: string
  upiId: string
  gstin: string
  fssaiNo: string
  deliveryFeeRupees: number
  freeAboveRupees: number
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const t = useTranslations("farm.settings")
  const te = useTranslations("errors")
  const [s, setS] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => (setSaved(false), setS({ ...s, [k]: v }))

  const field = (k: keyof Settings, label: string, opts: { hint?: string; type?: string; lang?: string; required?: boolean; placeholder?: string } = {}) => (
    <label className="flex flex-col gap-1.5 text-sm font-semibold">
      {label}
      <Input
        type={opts.type ?? "text"}
        lang={opts.lang}
        required={opts.required}
        placeholder={opts.placeholder}
        inputMode={opts.type === "number" ? "numeric" : opts.type === "tel" ? "tel" : undefined}
        value={s[k]}
        onChange={(e) => set(k, (opts.type === "number" ? Number(e.target.value) : e.target.value) as never)}
        className="h-11 font-normal"
      />
      {opts.hint && <span className="font-normal text-muted-foreground">{opts.hint}</span>}
    </label>
  )

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await saveFarmSettings(s)
          if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
          else setSaved(true)
        })
      }}
    >
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("farm")}</h2>
        {field("nameTa", t("nameTa"), { lang: "ta", required: true })}
        {field("nameEn", t("nameEn"), { lang: "en", required: true })}
        {field("phone", t("phone"), { type: "tel", required: true })}
        {field("whatsappNumber", t("whatsapp"), { type: "tel", hint: t("whatsappHint") })}
      </section>
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("billing")}</h2>
        {field("upiId", t("upiId"), { placeholder: "merryfarms@okaxis", hint: t("upiHint") })}
        {field("gstin", t("gstin"), { hint: t("gstinHint") })}
        {field("fssaiNo", t("fssai"), { hint: t("fssaiHint") })}
      </section>
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("delivery")}</h2>
        {field("deliveryFeeRupees", t("deliveryFee"), { type: "number" })}
        {field("freeAboveRupees", t("freeAbove"), { type: "number", hint: t("freeAboveHint") })}
      </section>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {saved ? t("saved") : t("save")}
      </Button>
    </form>
  )
}
