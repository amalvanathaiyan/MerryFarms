"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { useTranslations } from "next-intl"
import { Banknote, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NumberStepper } from "@/components/farm/number-stepper"
import { useCheer } from "@/components/cheer"
import { sellAtCounterAction } from "@/app/actions/farm-orders"
import { formatRupees } from "@/domain/money"

export interface CounterProduct {
  id: string
  name: string
  pack: string
  pricePaise: number
  /** null: stock isn't counted. */
  stockQty: number | null
}

/**
 * A quick sale at the farm gate or a market stall: tap what they take, then how they paid. No name, no address. With
 * the farm's UPI ID, "Paid by UPI" first shows a code with the amount for the buyer to scan.
 */
export function CounterSale({ products, upi }: { products: CounterProduct[]; upi: { id: string; payee: string } | null }) {
  const t = useTranslations("farm.counter")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const [qty, setQty] = useState<Record<string, string>>({})
  const [qr, setQr] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const lines = useMemo(() => products.map((p) => ({ p, n: Math.max(0, Math.floor(Number(qty[p.id]) || 0)) })).filter((l) => l.n > 0), [products, qty])
  const total = lines.reduce((a, l) => a + l.p.pricePaise * l.n, 0)

  const sell = (paid: "cash" | "upi") =>
    start(async () => {
      setError(null)
      const r = await sellAtCounterAction({ items: lines.map((l) => ({ productId: l.p.id, qty: l.n })), paid })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      cheer("sold", { code: r.code, amount: formatRupees(r.totalPaise) })
      setQty({})
      setQr(null)
    })

  const showUpi = async () => {
    if (!upi) return sell("upi")
    const params = new URLSearchParams({ pa: upi.id, pn: upi.payee, am: (total / 100).toFixed(2), cu: "INR" })
    setQr(await QRCode.toDataURL(`upi://pay?${params.toString()}`, { margin: 1, width: 260 }))
  }

  return (
    <div className="flex flex-col gap-4">
      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-muted-foreground">
          {t("noProducts")}{" "}
          <Link href="/farm/catalogue" className="font-semibold text-primary underline underline-offset-4">
            {t("addProducts")}
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => {
            const out = p.stockQty != null && p.stockQty <= 0
            return (
              <li key={p.id} className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border bg-card p-3">
                <div className="min-w-0 flex-1 basis-40">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.pack} · <b className="text-foreground tabular-nums">{formatRupees(p.pricePaise)}</b>
                    {p.stockQty != null && <span className={out ? "text-destructive" : ""}> · {t("left", { count: p.stockQty })}</span>}
                  </div>
                </div>
                <NumberStepper label={t("qty")} value={qty[p.id] ?? ""} onChange={(v) => setQty((c) => ({ ...c, [p.id]: v }))} className="w-40" />
              </li>
            )
          })}
        </ul>
      )}

      {/* The total and how they paid stay in reach at the bottom. */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] z-20 rounded-2xl border bg-card/95 p-3 shadow-md backdrop-blur lg:bottom-4">
        <div className="flex flex-col gap-2">
          {qr ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-center font-semibold">{t("scanToPay", { amount: formatRupees(total) })}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={t("upiCode")} className="size-52 rounded-xl border bg-white p-1" />
              <div className="grid w-full grid-cols-2 gap-2">
                <Button type="button" size="lg" className="h-12" disabled={pending} onClick={() => sell("upi")}>
                  {t("gotIt")}
                </Button>
                <Button type="button" size="lg" variant="outline" className="h-12" onClick={() => setQr(null)}>
                  {t("back")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-muted-foreground">{t("total")}</span>
                <b className="text-2xl tabular-nums">{formatRupees(total)}</b>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="lg" className="h-12" disabled={pending || lines.length === 0} onClick={() => sell("cash")}>
                  <Banknote aria-hidden /> {t("paidCash")}
                </Button>
                <Button type="button" size="lg" variant="outline" className="h-12" disabled={pending || lines.length === 0} onClick={showUpi}>
                  <Smartphone aria-hidden /> {upi ? t("payUpi") : t("paidUpi")}
                </Button>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
