"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cancelMyOrder } from "@/app/actions/shop"
import { CUSTOMER_CANCEL_REASONS } from "@/domain/orders"

/**
 * Change or cancel on the customer's own open order, until the slot's cut-off;
 * after that, a call to the farm.
 */
export function OrderSelfService({ orderId, canChange, farmPhone, webShop }: { orderId: string; canChange: boolean; farmPhone: string; webShop: boolean }) {
  const t = useTranslations("my")
  const te = useTranslations("errors")
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (!canChange) {
    return (
      <a href={`tel:${farmPhone}`} className="flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
        <Phone className="size-4" /> {t("callToChange")}
      </a>
    )
  }

  if (asking) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed p-3">
        <p className="text-sm font-semibold">{t("cancelWhy")}</p>
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_CANCEL_REASONS.map((r) => (
            <Button
              key={r}
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const res = await cancelMyOrder({ orderId, reason: r })
                  if (!res.ok) return setError(te.has(res.error) ? te(res.error) : te("generic"))
                  router.refresh()
                })
              }
            >
              {t(`cancel_${r}`)}
            </Button>
          ))}
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <button type="button" className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => setAsking(false)}>
          {t("keepOrder")}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {webShop && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/?change=${orderId}`}>{t("changeOrder")}</Link>
        </Button>
      )}
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setAsking(true)}>
        {t("cancelOrder")}
      </Button>
    </div>
  )
}
