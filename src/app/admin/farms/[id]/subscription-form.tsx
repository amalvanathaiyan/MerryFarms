"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { RotateCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { removeSubscriptionAction, setSubscriptionAction } from "@/app/actions/platform-plans"
import { SUBSCRIPTION_STATES } from "@/domain/entitlements"
import { MODULE_KEYS, MODULES, type ModuleKey } from "@/domain/modules"

type PlanOption = { id: string; label: string; modules: string[]; retired: boolean }
type Sub = {
  planId: string
  status: (typeof SUBSCRIPTION_STATES)[number]
  billingCycle: "monthly" | "yearly"
  trialEndsOn: string | null
  addOns: string[]
  moduleOverrides: Record<string, boolean>
  priceOverrideRupees: number | null
  notes: string
}

const chip = (on: boolean) => cn("min-h-11 rounded-xl border px-3 text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")

/**
 * The farm's plan and modules: which plan, its state, add-on modules, and admin's own per-module switches. Saving
 * works out what the farm may use straight away. "Back to the old level" removes the plan.
 */
export function SubscriptionForm({ tenantId, plans, initial, modulesNow }: { tenantId: string; plans: PlanOption[]; initial: Sub | null; modulesNow: string[] }) {
  const t = useTranslations("admin.subscription")
  const tm = useTranslations("modules")
  const te = useTranslations("errors")
  const router = useRouter()
  const [s, setS] = useState<Sub>(initial ?? { planId: plans.find((p) => !p.retired)?.id ?? "", status: "trial", billingCycle: "monthly", trialEndsOn: null, addOns: [], moduleOverrides: {}, priceOverrideRupees: null, notes: "" })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const plan = plans.find((p) => p.id === s.planId)
  const optional = MODULE_KEYS.filter((m) => !MODULES[m].alwaysOn && MODULES[m].available)

  const override = (m: ModuleKey): "plan" | "add" | "remove" => (s.moduleOverrides[m] === true ? "add" : s.moduleOverrides[m] === false ? "remove" : "plan")
  const setOverride = (m: ModuleKey, v: "plan" | "add" | "remove") =>
    setS((x) => {
      const o = { ...x.moduleOverrides }
      if (v === "plan") delete o[m]
      else o[m] = v === "add"
      return { ...x, moduleOverrides: o }
    })

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await setSubscriptionAction(tenantId, {
        planId: s.planId,
        status: s.status,
        billingCycle: s.billingCycle,
        trialEndsOn: s.trialEndsOn || null,
        addOns: s.addOns,
        moduleOverrides: s.moduleOverrides,
        priceOverridePaise: s.priceOverrideRupees === null ? null : Math.round(s.priceOverrideRupees * 100),
        notes: s.notes || null,
      })
      setMsg(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      if (r.ok) router.refresh()
    })

  if (!plans.length) return <p className="rounded-2xl border border-dashed p-4 text-muted-foreground">{t("noPlans")}</p>

  return (
    <div className="flex flex-col gap-4">
      {!initial && <p className="rounded-xl bg-yolk p-3 text-sm text-yolk-foreground">{t("onOldLevel")}</p>}

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("plan")}</span>
        <div className="flex flex-wrap gap-2">
          {plans.map((p) => (
            <button key={p.id} type="button" aria-pressed={s.planId === p.id} className={chip(s.planId === p.id)} onClick={() => setS({ ...s, planId: p.id })}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("status")}</span>
        <div className="flex flex-wrap gap-2">
          {SUBSCRIPTION_STATES.map((st) => (
            <button key={st} type="button" aria-pressed={s.status === st} className={chip(s.status === st)} onClick={() => setS({ ...s, status: st })}>
              {t(`status_${st}`)}
            </button>
          ))}
        </div>
        {(s.status === "paused" || s.status === "ended") && <p className="text-sm text-muted-foreground">{t("pausedHint")}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("cycle")}</span>
          <div className="flex gap-2">
            {(["monthly", "yearly"] as const).map((c) => (
              <button key={c} type="button" aria-pressed={s.billingCycle === c} className={chip(s.billingCycle === c)} onClick={() => setS({ ...s, billingCycle: c })}>
                {t(`cycle_${c}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("trialEnds")}</span>
          <Input type="date" value={s.trialEndsOn ?? ""} onChange={(e) => setS({ ...s, trialEndsOn: e.target.value || null })} className="h-11" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">{t("price")}</span>
          <Input type="number" inputMode="decimal" min={0} placeholder={t("planPrice")} value={s.priceOverrideRupees ?? ""} onChange={(e) => setS({ ...s, priceOverrideRupees: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} className="h-11" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-semibold">{t("modules")}</span>
        <p className="text-sm text-muted-foreground">{t("modulesHint")}</p>
        <ul className="flex flex-col divide-y rounded-2xl border">
          {optional.map((m) => {
            const inPlan = !!plan?.modules.includes(m)
            const addOn = s.addOns.includes(m)
            return (
              <li key={m} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-medium">{tm(m)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {inPlan ? t("inPlan") : t("notInPlan")}
                    {modulesNow.includes(m) ? ` · ${t("onNow")}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {!inPlan && (
                    <button type="button" aria-pressed={addOn} className={chip(addOn)} onClick={() => setS((x) => ({ ...x, addOns: addOn ? x.addOns.filter((y) => y !== m) : [...x.addOns, m] }))}>
                      {t("addOn")}
                    </button>
                  )}
                  {(["plan", "add", "remove"] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={override(m) === v} className={chip(override(m) === v)} onClick={() => setOverride(m, v)}>
                      {t(`override_${v}`)}
                    </button>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">{t("notes")}</span>
        <Input value={s.notes} maxLength={500} onChange={(e) => setS({ ...s, notes: e.target.value })} />
      </label>

      {msg && (
        <p role="status" className={msg.ok ? "rounded-xl bg-accent p-3 font-medium" : "rounded-xl bg-destructive/10 p-3 font-medium text-destructive"}>
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" className="h-12" disabled={pending || !s.planId} onClick={save}>
          <Save /> {t("save")}
        </Button>
        {initial && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await removeSubscriptionAction(tenantId)
                router.refresh()
              })
            }
          >
            <RotateCcw /> {t("backToOldLevel")}
          </Button>
        )}
      </div>
    </div>
  )
}
