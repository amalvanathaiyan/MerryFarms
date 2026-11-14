"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Ban, IndianRupee, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { recordPaymentAction, removePaymentAction, voidInvoiceAction } from "@/app/actions/platform-billing"

const METHODS = ["upi", "bank", "cash", "other"] as const

function useRun() {
  const te = useTranslations("errors")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      after?.()
      router.refresh()
    })
  return { error, pending, run }
}

/** Money received: how much (the amount left, to start), how, its reference and the day. */
export function PaymentForm({ invoiceId, leftRupees, today }: { invoiceId: string; leftRupees: number; today: string }) {
  const t = useTranslations("admin.billing")
  const { error, pending, run } = useRun()
  const [p, setP] = useState({ rupees: leftRupees as number | null, method: "upi" as (typeof METHODS)[number], reference: "", paidOn: today })
  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => recordPaymentAction({ invoiceId, amountPaise: Math.round((p.rupees ?? 0) * 100), method: p.method, reference: p.reference.trim() || null, paidOn: p.paidOn }))
      }}
    >
      <h2 className="font-semibold">{t("recordPayment")}</h2>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("method")}>
        {METHODS.map((m) => (
          <button key={m} type="button" aria-pressed={p.method === m} onClick={() => setP({ ...p, method: m })} className={cn("min-h-11 rounded-xl border px-3 text-sm font-medium", p.method === m ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}>
            {t(`method_${m}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("amount")}</span>
          <Input type="number" inputMode="decimal" min={0.01} max={leftRupees} step="0.01" value={p.rupees ?? ""} onChange={(e) => setP({ ...p, rupees: e.target.value === "" ? null : Number(e.target.value) })} className="tabular-nums" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("reference")}</span>
          <Input value={p.reference} maxLength={80} placeholder={t("referenceHint")} onChange={(e) => setP({ ...p, reference: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("paidOn")}</span>
          <Input type="date" value={p.paidOn} max={today} onChange={(e) => setP({ ...p, paidOn: e.target.value })} />
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending || !p.rupees || !p.paidOn} className="self-start">
        <IndianRupee /> {t("savePayment")}
      </Button>
    </form>
  )
}

/** Takes back a payment entered by mistake, after a confirm. */
export function RemovePayment({ id }: { id: string }) {
  const t = useTranslations("admin.billing")
  const { error, pending, run } = useRun()
  return (
    <span className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => confirm(t("removePaymentSure")) && run(() => removePaymentAction(id))}>
        <Undo2 /> {t("removePayment")}
      </Button>
    </span>
  )
}

/** Cancels an invoice made by mistake, with a reason. Its number stays used, as GST asks. */
export function VoidInvoice({ id }: { id: string }) {
  const t = useTranslations("admin.billing")
  const { error, pending, run } = useRun()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  if (!open)
    return (
      <Button type="button" variant="ghost" className="text-destructive" onClick={() => setOpen(true)}>
        <Ban /> {t("void")}
      </Button>
    )
  return (
    <form
      className="flex w-full flex-col gap-2 rounded-xl border border-destructive/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => voidInvoiceAction(id, reason), () => setOpen(false))
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("voidWhy")}</span>
        <Input value={reason} required minLength={3} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={pending || reason.trim().length < 3}>
          <Ban /> {t("voidConfirm")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t("keep")}
        </Button>
      </div>
    </form>
  )
}
