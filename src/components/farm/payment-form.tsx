"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addPaymentAction } from "@/app/actions/billing"
import { cn } from "@/lib/utils"

/** Record money received from a customer (clearing khata dues or paying in advance). */
export function PaymentForm({ customerId, suggestedRupees }: { customerId: string; suggestedRupees?: number }) {
  const t = useTranslations("farm.customers")
  const te = useTranslations("errors")
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(suggestedRupees ? String(suggestedRupees) : "")
  const [method, setMethod] = useState<"cash_on_delivery" | "upi_on_delivery">("upi_on_delivery")
  const [reference, setReference] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <Button size="lg" variant="outline" onClick={() => (setOpen(true), setSaved(false))}>
        {saved ? `${t("paymentSaved")} · ` : ""}
        {t("recordPayment")}
      </Button>
    )
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await addPaymentAction({ customerId, amountRupees: Number(amount), method, reference: reference || undefined })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          setSaved(true)
          setOpen(false)
          setReference("")
        })
      }}
    >
      <h2 className="text-lg font-semibold">{t("recordPayment")}</h2>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("amountRupees")}
        <Input required type="number" min={1} step="0.5" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 font-normal" />
      </label>
      <div className="flex gap-2">
        {(["upi_on_delivery", "cash_on_delivery"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={cn("flex-1 rounded-full border px-4 py-2 text-sm font-medium", method === m ? "border-primary bg-accent" : "bg-card")}>
            {t(m === "upi_on_delivery" ? "methodUpi" : "methodCash")}
          </button>
        ))}
      </div>
      {method === "upi_on_delivery" && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("reference")}
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="h-11 font-normal" />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {t("savePayment")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
