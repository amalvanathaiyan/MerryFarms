"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { GST_RATES, isGstin, type BillingProfile } from "@/domain/platform-billing"
import { saveBillingProfileAction } from "@/app/actions/platform-billing"

const area = "rounded-xl border bg-background px-3 py-2 text-base"

/**
 * Farm For You's details printed on every invoice, where farms pay, and the GST switch. GST's own fields show only
 * once it is switched on, and it can't be switched on without a valid GSTIN.
 */
export function BillingProfileForm({ initial }: { initial: BillingProfile }) {
  const t = useTranslations("admin.billing")
  const te = useTranslations("errors")
  const router = useRouter()
  const [p, setP] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const set = <K extends keyof BillingProfile>(k: K, v: BillingProfile[K]) => setP((x) => ({ ...x, [k]: v }))
  const gstinBad = p.gstOn && !isGstin(p.gstin.trim().toUpperCase())

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await saveBillingProfileAction({ ...p, gstin: p.gstin.trim().toUpperCase() })
      setMsg(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      if (r.ok) router.refresh()
    })

  const field = (k: "name" | "phone" | "email" | "upiId", type = "text") => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{t(`p_${k}`)}</span>
      <Input type={type} value={p[k]} maxLength={k === "email" ? 120 : 80} onChange={(e) => set(k, e.target.value)} />
    </label>
  )

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">{t("onInvoice")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("name")}
          {field("phone", "tel")}
          {field("email", "email")}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("p_dueDays")}</span>
            <Input type="number" inputMode="numeric" min={0} max={90} value={p.dueDays} onChange={(e) => set("dueDays", Math.max(0, Math.min(90, Math.round(Number(e.target.value) || 0))))} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("p_address")}</span>
          <textarea rows={2} maxLength={300} value={p.address} onChange={(e) => set("address", e.target.value)} className={area} />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">{t("wherePay")}</legend>
        {field("upiId")}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("p_bank")}</span>
          <textarea rows={3} maxLength={300} value={p.bank} placeholder={t("p_bankHint")} onChange={(e) => set("bank", e.target.value)} className={area} />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">GST</legend>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 size-5 accent-primary" checked={p.gstOn} onChange={(e) => set("gstOn", e.target.checked)} />
          <span>
            <span className="block font-semibold">{t("gstOn")}</span>
            <span className="text-sm text-muted-foreground">{t("gstOnHint")}</span>
          </span>
        </label>
        {p.gstOn && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">GSTIN</span>
              <Input value={p.gstin} maxLength={15} autoCapitalize="characters" aria-invalid={gstinBad} onChange={(e) => set("gstin", e.target.value)} className="font-mono uppercase" />
              {gstinBad && <span className="text-sm text-destructive">{te("gstin_invalid")}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("p_sac")}</span>
              <Input inputMode="numeric" maxLength={8} value={p.sac} onChange={(e) => set("sac", e.target.value.replace(/\D/g, ""))} className="font-mono" />
            </label>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-semibold">{t("p_rate")}</span>
              <div className="flex flex-wrap gap-2">
                {GST_RATES.map((r) => (
                  <button key={r} type="button" aria-pressed={p.gstRatePct === r} onClick={() => set("gstRatePct", r)} className={cn("min-h-11 min-w-16 rounded-xl border px-3 font-semibold", p.gstRatePct === r ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}>
                    {r}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </fieldset>

      {msg && <p className={cn("text-sm font-medium", msg.ok ? "text-primary" : "text-destructive")}>{msg.text}</p>}
      <Button type="submit" disabled={pending || gstinBad} className="self-start">
        <Save /> {t("saveProfile")}
      </Button>
    </form>
  )
}
