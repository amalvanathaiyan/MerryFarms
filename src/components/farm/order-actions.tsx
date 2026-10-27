"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { FileText, MessageCircle, Pencil, Phone, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { changeOrderStatus, logCall } from "@/app/actions/farm-orders"
import { deliver } from "@/app/actions/billing"
import { isEditable, nextStep, type OrderStatus } from "@/domain/orders"
import { cn } from "@/lib/utils"

const OUTCOMES = ["confirmed", "changed", "cancelled", "no_answer", "wrong_number"] as const

export function OrderActions({
  orderId,
  status,
  phone,
  callScript,
  waLink,
  invoiceId,
  allowCredit,
  canEdit,
  canReturn,
}: {
  orderId: string
  status: OrderStatus
  phone: string
  callScript: string
  waLink: string | null
  invoiceId: string | null
  allowCredit: boolean
  /** Order desk staff, and not a walk-in sale. */
  canEdit: boolean
  /** Returns switched on, order desk staff, and the order is delivered. */
  canReturn: boolean
}) {
  const t = useTranslations("farm.orders")
  const te = useTranslations("errors")
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [armedCancel, setArmedCancel] = useState(false)
  const [note, setNote] = useState("")
  const [info, setInfo] = useState<string | null>(null)

  const run = (fn: () => Promise<{ ok: boolean; error?: string; needsOwner?: boolean }>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else if (r.needsOwner) setInfo(t("needsOwner"))
    })

  const next = status === "to_confirm" ? null : nextStep(status)
  const canCancel = status === "to_confirm" || status === "confirmed" || status === "packed"

  return (
    <div className="flex flex-col gap-2 pt-1">
      {status === "to_confirm" && (
        <>
          <Button asChild size="lg" className="h-12 text-base">
            <a href={`tel:${phone}`}>
              <Phone /> {t("call")}
            </a>
          </Button>
          <div className="rounded-lg bg-yolk px-3 py-2 text-sm text-yolk-foreground">
            <span className="font-semibold">{t("callScript")}:</span> {callScript}
          </div>
          <input
            aria-label={t("note")}
            placeholder={t("note")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-10 rounded-md border border-input bg-transparent px-3"
          />
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) =>
              o === "changed" && canEdit ? (
                // A change agreed on the call: edit the order, and saving confirms it.
                <Button key={o} asChild variant="outline">
                  <Link href={`/farm/orders/${orderId}/edit?call=1`}>{t(`outcome_${o}`)}</Link>
                </Button>
              ) : (
              <Button
                key={o}
                variant={o === "confirmed" ? "default" : "outline"}
                disabled={pending}
                className={o === "cancelled" ? "text-destructive" : undefined}
                onClick={() => run(() => logCall({ orderId, outcome: o, note: note || undefined }))}
              >
                {t(`outcome_${o}`)}
              </Button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("changedHint")}</p>
        </>
      )}

      {next === "delivered" && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-2">
          <span className="text-sm font-semibold">{t("howPaid")}</span>
          <div className={cn("grid gap-2", allowCredit ? "grid-cols-3" : "grid-cols-2")}>
            {(allowCredit ? (["cash", "upi", "credit"] as const) : (["cash", "upi"] as const)).map((p) => (
              <Button key={p} variant={p === "credit" ? "outline" : "default"} disabled={pending} onClick={() => run(() => deliver({ orderId, payment: p }))}>
                {t(`paid_${p}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {next && next !== "delivered" && (
          <Button className="flex-1" disabled={pending} onClick={() => run(() => changeOrderStatus({ orderId, to: next }))}>
            {t(`next_${next}`)}
          </Button>
        )}
        {waLink && (
          <Button asChild variant="outline" className="flex-1">
            <a href={waLink} target="_blank" rel="noreferrer">
              <MessageCircle /> {t("whatsapp")}
            </a>
          </Button>
        )}
        {canEdit && isEditable(status) && status !== "to_confirm" && (
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/farm/orders/${orderId}/edit`}>
              <Pencil /> {t("edit")}
            </Link>
          </Button>
        )}
        {canReturn && status === "delivered" && (
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/farm/orders/${orderId}/return`}>
              <Undo2 /> {t("returnRefund")}
            </Link>
          </Button>
        )}
        {invoiceId && (
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/farm/invoices/${invoiceId}`}>
              <FileText /> {t("invoice")}
            </Link>
          </Button>
        )}
        {canCancel && status !== "to_confirm" && (
          <Button
            variant={armedCancel ? "destructive" : "outline"}
            disabled={pending}
            onClick={() => {
              if (!armedCancel) return setArmedCancel(true)
              setArmedCancel(false)
              run(() => changeOrderStatus({ orderId, to: "cancelled" }))
            }}
          >
            {armedCancel ? t("confirmCancel") : t("cancel")}
          </Button>
        )}
      </div>
      {info && <p className="text-sm font-medium text-yolk-foreground">{info}</p>}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
