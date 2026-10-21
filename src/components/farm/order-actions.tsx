"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { MessageCircle, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { changeOrderStatus, logCall } from "@/app/actions/farm-orders"
import { nextStep, type OrderStatus } from "@/domain/orders"

const OUTCOMES = ["confirmed", "changed", "cancelled", "no_answer", "wrong_number"] as const

export function OrderActions({
  orderId,
  status,
  phone,
  callScript,
  waLink,
}: {
  orderId: string
  status: OrderStatus
  phone: string
  callScript: string
  waLink: string | null
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
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                variant={o === "confirmed" ? "default" : "outline"}
                disabled={pending}
                className={o === "cancelled" ? "text-destructive" : undefined}
                onClick={() => run(() => logCall({ orderId, outcome: o, note: note || undefined }))}
              >
                {t(`outcome_${o}`)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("changedHint")}</p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {next && (
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
