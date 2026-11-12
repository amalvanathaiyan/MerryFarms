"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Archive, ArchiveRestore, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { retirePlanAction, savePlanAction } from "@/app/actions/platform-plans"
import { FEATURE_KEYS, FEATURES, type FeatureKey } from "@/domain/features"
import { LIMIT_KEYS, MODULE_KEYS, MODULES, type LimitKey, type ModuleKey } from "@/domain/modules"

type Rule = "farm" | "on" | "off"
type Draft = {
  nameTa: string
  nameEn: string
  descriptionTa: string
  descriptionEn: string
  monthlyRupees: number
  yearlyRupees: number | null
  trialDays: number
  modules: string[]
  features: Partial<Record<FeatureKey, "on" | "off">>
  limits: Partial<Record<LimitKey, number>>
  isPublic: boolean
  sortOrder: number
}

const chip = (on: boolean) => cn("min-h-11 rounded-xl border px-3 text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")

/**
 * A plan: names, price, trial, the modules in it, what each feature does in it (the farm chooses, always on, or
 * off), limits, and whether farms see it. Saving a plan farms are on, with changes to what they get or pay, makes a
 * new version; those farms stay on theirs.
 */
export function PlanEditor({ id, initial, farmsOn, retired }: { id: string | null; initial: Draft; farmsOn: number; retired: boolean }) {
  const t = useTranslations("admin.plans")
  const tm = useTranslations("modules")
  const tf = useTranslations("farm.features")
  const te = useTranslations("errors")
  const router = useRouter()
  const [d, setD] = useState(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const rule = (k: FeatureKey): Rule => d.features[k] ?? "farm"
  const setRule = (k: FeatureKey, r: Rule) =>
    setD((x) => {
      const features = { ...x.features }
      if (r === "farm") delete features[k]
      else features[k] = r
      return { ...x, features }
    })
  const toggleModule = (m: ModuleKey) => setD((x) => ({ ...x, modules: x.modules.includes(m) ? x.modules.filter((y) => y !== m) : [...x.modules, m] }))
  const included = (m: ModuleKey) => MODULES[m].alwaysOn || d.modules.includes(m)

  const save = () =>
    start(async () => {
      setMsg(null)
      const r = await savePlanAction(id, {
        nameTa: d.nameTa,
        nameEn: d.nameEn,
        descriptionTa: d.descriptionTa || null,
        descriptionEn: d.descriptionEn || null,
        monthlyPaise: Math.round(d.monthlyRupees * 100),
        yearlyPaise: d.yearlyRupees === null ? null : Math.round(d.yearlyRupees * 100),
        trialDays: d.trialDays,
        modules: d.modules,
        features: d.features,
        limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, d.limits[k] ?? null])),
        isPublic: d.isPublic,
        sortOrder: d.sortOrder,
      })
      if (!r.ok) return setMsg({ ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      if (r.newVersion) setMsg({ ok: true, text: t("savedNewVersion", { count: farmsOn }) })
      else setMsg({ ok: true, text: t("saved") })
      if (r.id && r.id !== id) router.replace(`/admin/plans/${r.id}`)
      else router.refresh()
    })

  const field = "flex flex-col gap-1.5"
  const num = (v: string) => (v === "" ? null : Math.max(0, Number(v)))

  return (
    <div className="flex flex-col gap-5">
      {farmsOn > 0 && <p className="rounded-xl bg-yolk p-3 text-sm text-yolk-foreground">{t("versionWarning", { count: farmsOn })}</p>}

      <section className="grid gap-4 rounded-3xl border bg-card p-5 sm:grid-cols-2">
        <label className={field}>
          <span className="font-semibold">{t("nameTa")}</span>
          <Input lang="ta" value={d.nameTa} maxLength={60} onChange={(e) => setD({ ...d, nameTa: e.target.value })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("nameEn")}</span>
          <Input lang="en" value={d.nameEn} maxLength={60} onChange={(e) => setD({ ...d, nameEn: e.target.value })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("descriptionTa")}</span>
          <Input lang="ta" value={d.descriptionTa} maxLength={300} onChange={(e) => setD({ ...d, descriptionTa: e.target.value })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("descriptionEn")}</span>
          <Input lang="en" value={d.descriptionEn} maxLength={300} onChange={(e) => setD({ ...d, descriptionEn: e.target.value })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("monthly")}</span>
          <Input type="number" inputMode="decimal" min={0} value={d.monthlyRupees} onChange={(e) => setD({ ...d, monthlyRupees: num(e.target.value) ?? 0 })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("yearly")}</span>
          <Input type="number" inputMode="decimal" min={0} placeholder={t("yearlyNone")} value={d.yearlyRupees ?? ""} onChange={(e) => setD({ ...d, yearlyRupees: num(e.target.value) })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("trial")}</span>
          <Input type="number" inputMode="numeric" min={0} max={365} value={d.trialDays} onChange={(e) => setD({ ...d, trialDays: num(e.target.value) ?? 0 })} />
        </label>
        <label className={field}>
          <span className="font-semibold">{t("order")}</span>
          <Input type="number" inputMode="numeric" min={0} value={d.sortOrder} onChange={(e) => setD({ ...d, sortOrder: num(e.target.value) ?? 0 })} />
        </label>
        <label className="flex items-start gap-3 sm:col-span-2">
          <input type="checkbox" className="mt-1 size-5 accent-primary" checked={d.isPublic} onChange={(e) => setD({ ...d, isPublic: e.target.checked })} />
          <span>
            <span className="block font-semibold">{t("isPublic")}</span>
            <span className="text-sm text-muted-foreground">{t("isPublicHint")}</span>
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-bold">{t("modulesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("modulesHint")}</p>
        </div>
        {MODULE_KEYS.map((m) => {
          const def = MODULES[m]
          const features = FEATURE_KEYS.filter((k) => FEATURES[k].module === m && FEATURES[k].available)
          return (
            <div key={m} className={cn("flex flex-col gap-3 rounded-2xl border p-4", !def.available && "opacity-60")}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={included(m)}
                  disabled={def.alwaysOn || !def.available}
                  onChange={() => toggleModule(m)}
                />
                <span className="font-semibold">{tm(m)}</span>
                {def.alwaysOn && <span className="rounded-full bg-accent px-2 text-xs">{t("alwaysIncluded")}</span>}
                {!def.available && <span className="rounded-full bg-yolk px-2 text-xs text-yolk-foreground">{t("comingSoon")}</span>}
              </label>
              {included(m) && features.length > 0 && (
                <ul className="flex flex-col divide-y">
                  {features.map((k) => (
                    <li key={k} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium">{tf(`${k}.title`)}</span>
                      <span className="flex flex-wrap gap-1.5" role="group" aria-label={tf(`${k}.title`)}>
                        {(["farm", "on", "off"] as const).map((r) => (
                          <button key={r} type="button" aria-pressed={rule(k) === r} className={chip(rule(k) === r)} onClick={() => setRule(k, r)}>
                            {t(`rule_${r}`)}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-bold">{t("limitsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("limitsHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIMIT_KEYS.map((k) => (
            <label key={k} className={field}>
              <span className="font-semibold">{t(`limit_${k}`)}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={t("noLimit")}
                value={d.limits[k] ?? ""}
                onChange={(e) => {
                  const v = num(e.target.value)
                  setD((x) => {
                    const limits = { ...x.limits }
                    if (v === null) delete limits[k]
                    else limits[k] = Math.round(v)
                    return { ...x, limits }
                  })
                }}
              />
            </label>
          ))}
        </div>
      </section>

      {msg && (
        <p role="status" className={msg.ok ? "rounded-xl bg-accent p-3 font-medium" : "rounded-xl bg-destructive/10 p-3 font-medium text-destructive"}>
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" size="lg" className="h-12" disabled={pending || !d.nameTa.trim() || !d.nameEn.trim()} onClick={save}>
          <Save /> {t("save")}
        </Button>
        {id && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await retirePlanAction(id, !retired)
                router.refresh()
              })
            }
          >
            {retired ? <ArchiveRestore /> : <Archive />} {retired ? t("unretire") : t("retire")}
          </Button>
        )}
      </div>
    </div>
  )
}
