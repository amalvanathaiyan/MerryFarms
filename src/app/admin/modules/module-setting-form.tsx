"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveModuleSettingAction } from "@/app/actions/platform-plans"
import type { ModuleKey } from "@/domain/modules"

type Setting = { key: ModuleKey; enabled: boolean; addOnMonthlyRupees: number | null; addOnYearlyRupees: number | null; addOnTrialDays: number; requestable: boolean }

/** One module as the platform offers it. Switching a module off takes it away from every farm at once (their data stays). */
export function ModuleSettingForm({ setting, alwaysOn, available, farmsUsing }: { setting: Setting; alwaysOn: boolean; available: boolean; farmsUsing: number }) {
  const t = useTranslations("admin.modules")
  const tm = useTranslations("modules")
  const te = useTranslations("errors")
  const router = useRouter()
  const [s, setS] = useState(setting)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const num = (v: string) => (v === "" ? null : Math.max(0, Number(v)))

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await saveModuleSettingAction({
        key: s.key,
        enabled: s.enabled,
        addOnMonthlyPaise: s.addOnMonthlyRupees === null ? null : Math.round(s.addOnMonthlyRupees * 100),
        addOnYearlyPaise: s.addOnYearlyRupees === null ? null : Math.round(s.addOnYearlyRupees * 100),
        addOnTrialDays: s.addOnTrialDays,
        requestable: s.requestable,
      })
      setMsg(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      if (r.ok) router.refresh()
    })

  return (
    <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{tm(s.key)}</h2>
        <span className="text-sm text-muted-foreground">{t("farmsUsing", { count: farmsUsing })}</span>
      </div>
      {alwaysOn ? (
        <p className="text-sm text-muted-foreground">{t("alwaysOn")}</p>
      ) : !available ? (
        <p className="rounded-xl bg-yolk p-2 text-sm text-yolk-foreground">{t("comingSoon")}</p>
      ) : (
        <>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-primary" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
            <span>
              <span className="block font-semibold">{t("enabled")}</span>
              <span className="text-sm text-muted-foreground">{t("enabledHint")}</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-primary" checked={s.requestable} onChange={(e) => setS({ ...s, requestable: e.target.checked })} />
            <span>
              <span className="block font-semibold">{t("requestable")}</span>
              <span className="text-sm text-muted-foreground">{t("requestableHint")}</span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("addOnMonthly")}</span>
              <Input type="number" inputMode="decimal" min={0} placeholder={t("free")} value={s.addOnMonthlyRupees ?? ""} onChange={(e) => setS({ ...s, addOnMonthlyRupees: num(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("addOnYearly")}</span>
              <Input type="number" inputMode="decimal" min={0} placeholder={t("none")} value={s.addOnYearlyRupees ?? ""} onChange={(e) => setS({ ...s, addOnYearlyRupees: num(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("addOnTrial")}</span>
              <Input type="number" inputMode="numeric" min={0} max={365} value={s.addOnTrialDays} onChange={(e) => setS({ ...s, addOnTrialDays: num(e.target.value) ?? 0 })} />
            </label>
          </div>
          {msg && <p className={msg.ok ? "text-sm font-medium text-primary" : "text-sm font-medium text-destructive"}>{msg.text}</p>}
          <Button type="button" className="self-start" disabled={pending} onClick={save}>
            <Save /> {t("save")}
          </Button>
        </>
      )}
    </section>
  )
}
