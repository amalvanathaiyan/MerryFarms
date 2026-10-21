"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { submitReturn } from "@/app/actions/returns"
import { formatRupees } from "@/domain/money"
import { cn } from "@/lib/utils"

const REASONS = ["damaged", "short_delivered", "returned", "quality", "other"] as const
type Refund = "account" | "cash" | "upi"

export function ReturnForm({
  orderId,
  lines,
  deliveryFeePaise,
  tracksStock,
  allowAccount,
  defaultRefund,
  earlierReturns,
}: {
  orderId: string
  lines: { productId: string; name: string; pack: string; unitPricePaise: number; left: number }[]
  deliveryFeePaise: number
  tracksStock: boolean
  allowAccount: boolean
  defaultRefund: Refund
  earlierReturns: { id: string; at: string; amountPaise: number; reason: string }[]
}) {
  const t = useTranslations("farm.returns")
  const te = useTranslations("errors")
  const router = useRouter()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<(typeof REASONS)[number]>("damaged")
  const [refund, setRefund] = useState<Refund>(defaultRefund)
  const [restock, setRestock] = useState(false)
  const [refundFee, setRefundFee] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const nothingLeft = lines.every((l) => l.left === 0)
  const everything = lines.every((l) => (qty[l.productId] ?? 0) >= l.left)
  const goods = lines.reduce((a, l) => a + (qty[l.productId] ?? 0) * l.unitPricePaise, 0)
  const fee = refundFee && everything ? deliveryFeePaise : 0
  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")

  if (nothingLeft) return <p className="rounded-xl bg-accent p-4">{t("allReturned")}</p>

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await submitReturn({
            orderId,
            items: lines.map((l) => ({ productId: l.productId, qty: qty[l.productId] ?? 0 })).filter((i) => i.qty > 0),
            reason,
            note: note || undefined,
            refundMethod: refund,
            restock: tracksStock && restock,
            refundDeliveryFee: fee > 0,
          })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          router.push(r.creditNoteId ? `/farm/invoices/${r.creditNoteId}` : "/farm/orders?tab=done")
        })
      }}
    >
      <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-semibold">{t("whatCameBack")}</h2>
        <ul className="divide-y">
          {lines.map((l) => {
            const q = qty[l.productId] ?? 0
            return (
              <li key={l.productId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {l.pack} · {formatRupees(l.unitPricePaise)} · {t("canReturn", { count: l.left })}
                  </div>
                </div>
                <div className="flex shrink-0 items-center overflow-hidden rounded-xl border border-primary text-primary">
                  <button type="button" className="grid size-10 place-items-center disabled:opacity-40" disabled={q === 0} aria-label="−1" onClick={() => setQty({ ...qty, [l.productId]: q - 1 })}>
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-8 text-center font-bold tabular-nums">{q}</span>
                  <button type="button" className="grid size-10 place-items-center disabled:opacity-40" disabled={q >= l.left} aria-label="+1" onClick={() => setQty({ ...qty, [l.productId]: q + 1 })}>
                    <Plus className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("reason")}</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={chip(reason === r)}>
              {t(`reason_${r}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{t("settle")}</legend>
        <div className="flex flex-wrap gap-2">
          {(allowAccount ? (["account", "cash", "upi"] as const) : (["cash", "upi"] as const)).map((m) => (
            <button key={m} type="button" aria-pressed={refund === m} onClick={() => setRefund(m)} className={chip(refund === m)}>
              {t(`refund_${m}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        {tracksStock && (
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block font-semibold">{t("restock")}</span>
              <span className="block text-sm text-muted-foreground">{t("restockHint")}</span>
            </span>
            <input type="checkbox" className="mt-1 size-6 accent-[hsl(var(--primary))]" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          </label>
        )}
        {deliveryFeePaise > 0 && (
          <label className={cn("flex items-start justify-between gap-3", !everything && "opacity-60")}>
            <span>
              <span className="block font-semibold">{t("refundFee", { amount: formatRupees(deliveryFeePaise) })}</span>
              <span className="block text-sm text-muted-foreground">{t("refundFeeHint")}</span>
            </span>
            <input type="checkbox" disabled={!everything} className="mt-1 size-6 accent-[hsl(var(--primary))]" checked={refundFee && everything} onChange={(e) => setRefundFee(e.target.checked)} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("note")}
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11 font-normal" />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-2xl border-2 border-primary bg-accent p-4 text-lg font-bold tabular-nums">
        <span>{refund === "account" ? t("creditTotal") : t("refundTotal")}</span>
        <span>{formatRupees(goods + fee)}</span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-14 text-lg" disabled={pending || goods + fee === 0}>
        {t("submit")}
      </Button>

      {earlierReturns.length > 0 && (
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-1 font-semibold">{t("earlier")}</h2>
          <ul className="divide-y">
            {earlierReturns.map((r) => (
              <li key={r.id} className="flex justify-between py-1.5 tabular-nums">
                <span>
                  {new Date(r.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} · {t(`reason_${r.reason}`)}
                </span>
                <span>{formatRupees(r.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  )
}
