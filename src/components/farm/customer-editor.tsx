"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updateCustomer } from "@/app/actions/billing"
import { LOCALE_LABELS } from "@/i18n/routing"
import { useCheer } from "@/components/cheer"
import { CUSTOMER_KINDS, type CustomerKind } from "@/domain/customers"
import { cn } from "@/lib/utils"

type Customer = {
  id: string
  name: string
  language: "ta" | "en"
  isTrusted: boolean
  creditLimitRupees: number
  marketingOptIn: boolean
  smsOptIn: boolean
  kind: CustomerKind
  notes: string
}

type How = "in_person" | "phone"

export function CustomerEditor({ customer, canEdit, showCredit, showTrusted }: { customer: Customer; canEdit: boolean; showCredit: boolean; showTrusted: boolean }) {
  const t = useTranslations("farm.customers")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [c, setC] = useState(customer)
  const [how, setHow] = useState<How>("in_person")
  const offersChanged = c.marketingOptIn !== customer.marketingOptIn || c.smsOptIn !== customer.smsOptIn
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
          const r = await updateCustomer({ ...c, consentHow: how, notes: c.notes || undefined })
          if (!r.ok) setError(te.has(r.error) ? te(r.error) : te("generic"))
          else {
            setSaved(true)
            cheer("customer")
          }
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
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("kind")}
          <select value={c.kind} onChange={(e) => set("kind", e.target.value as CustomerKind)} className="h-11 rounded-md border border-input bg-transparent px-3 font-normal">
            {CUSTOMER_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind_${k}`)}
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
        <OffersFields whatsapp={c.marketingOptIn} sms={c.smsOptIn} onChange={(w, m) => (setSaved(false), setC({ ...c, marketingOptIn: w, smsOptIn: m }))} how={offersChanged ? how : null} onHow={setHow} />
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
        {hint && <span className="block text-sm text-muted-foreground">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 size-6 shrink-0 accent-[hsl(var(--primary))]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** Offers on WhatsApp and by SMS, and (when one is changed) how the customer told the farm: kept as proof. */
export function OffersFields({ whatsapp, sms, onChange, how, onHow }: { whatsapp: boolean; sms: boolean; onChange: (whatsapp: boolean, sms: boolean) => void; how: How | null; onHow: (h: How) => void }) {
  const t = useTranslations("farm.customers")
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold">{t("offers")}</legend>
      <p className="-mt-2 text-sm text-muted-foreground">{t("optInHint")}</p>
      <Toggle label={t("offersWhatsapp")} hint="" checked={whatsapp} onChange={(v) => onChange(v, sms)} />
      <Toggle label={t("offersSms")} hint="" checked={sms} onChange={(v) => onChange(whatsapp, v)} />
      {how && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("consentHow")}</span>
          <div className="grid grid-cols-2 gap-1.5">
            {(["in_person", "phone"] as const).map((h) => (
              <button key={h} type="button" aria-pressed={how === h} onClick={() => onHow(h)} className={cn("min-h-11 rounded-xl border-2 px-2 text-sm font-semibold", how === h ? "border-primary bg-accent" : "bg-card")}>
                {t(`consent_${h}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </fieldset>
  )
}
