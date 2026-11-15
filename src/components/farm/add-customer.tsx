"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addCustomerAction } from "@/app/actions/billing"
import { CUSTOMER_KINDS, STAFF_SOURCES, type CustomerKind } from "@/domain/customers"
import { LOCALE_LABELS } from "@/i18n/routing"
import { cn } from "@/lib/utils"
import { useCheer } from "@/components/cheer"
import { OffersFields } from "./customer-editor"

const field = "flex flex-col gap-1.5 text-sm font-semibold"
const select = "h-12 rounded-md border bg-background px-3 text-base font-normal"
const chip = (on: boolean) => cn("min-h-11 rounded-xl border-2 px-2 text-sm font-semibold", on ? "border-primary bg-accent" : "bg-card hover:border-primary")

type Source = (typeof STAFF_SOURCES)[number]

/**
 * A customer who came in person, by phone or at the market: name, number, how they came. Everything else is optional.
 * When they later sign in online with the same number, they get this record.
 */
export function AddCustomer() {
  const t = useTranslations("farm.customers")
  const te = useTranslations("errors")
  const router = useRouter()
  const cheer = useCheer()
  const [open, setOpen] = useState(false)
  const blank = { name: "", phone: "", language: "ta" as "ta" | "en", source: "walk_in" as Source, kind: "home" as CustomerKind, whatsappOffers: false, smsOffers: false, addressLine: "", landmark: "", pincode: "" }
  const [f, setF] = useState(blank)
  const [how, setHow] = useState<"in_person" | "phone">("in_person")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!open)
    return (
      <Button type="button" variant="outline" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
        <UserPlus aria-hidden /> {t("add")}
      </Button>
    )

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await addCustomerAction({ ...f, consentHow: how })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          if (!r.existed) cheer("customer")
          router.push(`/farm/customers/${r.id}${r.existed ? "?known=1" : ""}`)
        })
      }}
    >
      <h2 className="text-lg font-semibold">{t("add")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("name")}
          <Input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-12 font-normal" />
        </label>
        <label className={field}>
          {t("mobile")}
          <Input required type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-sm font-semibold">{t("cameHow")}</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {STAFF_SOURCES.map((s) => (
            <button key={s} type="button" aria-pressed={f.source === s} className={chip(f.source === s)} onClick={() => setF({ ...f, source: s })}>
              {t(`source_${s}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className={field}>
          {t("kind")}
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CustomerKind })} className={select}>
            {CUSTOMER_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind_${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={field}>
          {t("language")}
          <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as "ta" | "en" })} className={select}>
            {(["ta", "en"] as const).map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-semibold">{t("addressOptional")}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <textarea rows={2} maxLength={300} value={f.addressLine} onChange={(e) => setF({ ...f, addressLine: e.target.value })} aria-label={t("address")} placeholder={t("address")} className="rounded-xl border bg-card px-3 py-2 text-base" />
          <div className="grid grid-cols-2 gap-3">
            <Input maxLength={120} value={f.landmark} onChange={(e) => setF({ ...f, landmark: e.target.value })} placeholder={t("landmark")} aria-label={t("landmark")} className="h-12" />
            <Input inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, "") })} placeholder={t("pincode")} aria-label={t("pincode")} className="h-12 tabular-nums" />
          </div>
        </div>
      </details>
      <OffersFields
        whatsapp={f.whatsappOffers}
        sms={f.smsOffers}
        onChange={(w, s) => setF({ ...f, whatsappOffers: w, smsOffers: s })}
        how={f.whatsappOffers || f.smsOffers ? how : null}
        onHow={setHow}
      />
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {t("addSave")}
        </Button>
        <Button type="button" variant="ghost" size="lg" className="h-12" onClick={() => (setOpen(false), setF(blank), setError(null))}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
