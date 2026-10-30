"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addOwnerAction, resetPasswordAction, updateFarmAction } from "@/app/actions/admin"
import { cn } from "@/lib/utils"

const PLANS = ["free", "starter", "growth", "pro"] as const
const STATUSES = ["trial", "active", "suspended"] as const

type Farm = {
  id: string
  nameTa: string
  nameEn: string
  phone: string
  invoicePrefix: string
  defaultLanguage: "ta" | "en"
  plan: (typeof PLANS)[number]
  status: (typeof STATUSES)[number]
  trialEndsOn: string | null
}

const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")

/** Plan, status, trial end and the farm's basic details. Suspending pauses the farm's shop at once. */
export function EditFarmForm({ farm }: { farm: Farm }) {
  const t = useTranslations("admin")
  const te = useTranslations("errors")
  const router = useRouter()
  const [f, setF] = useState(farm)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    start(async () => {
      const r = await updateFarmAction({ ...f, trialEndsOn: f.status === "trial" ? f.trialEndsOn : null })
      if (!r.ok) return setMsg({ ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
      setMsg({ ok: true, text: t("saved") })
      router.refresh()
    })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
      <h2 className="text-lg font-bold">{t("planAndStatus")}</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{t("plan")}</legend>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <button key={p} type="button" aria-pressed={f.plan === p} className={chip(f.plan === p)} onClick={() => setF({ ...f, plan: p })}>
              {t(`plan_${p}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{t("status")}</legend>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button key={s} type="button" aria-pressed={f.status === s} className={chip(f.status === s)} onClick={() => setF({ ...f, status: s })}>
              {t(`status_${s}`)}
            </button>
          ))}
        </div>
        {f.status === "suspended" && <p className="text-sm font-medium text-destructive">{t("suspendHint")}</p>}
      </fieldset>
      {f.status === "trial" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="trialEnd" className="text-sm font-semibold">
            {t("trialEndsOn")}
          </label>
          <Input id="trialEnd" type="date" value={f.trialEndsOn ?? ""} onChange={(e) => setF({ ...f, trialEndsOn: e.target.value || null })} className="h-12 max-w-48" />
        </div>
      )}

      <h2 className="mt-2 text-lg font-bold">{t("farmDetails")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["nameTa", t("nameTa"), "ta"],
            ["nameEn", t("nameEn"), "en"],
            ["phone", t("farmPhone"), undefined],
            ["invoicePrefix", t("invoicePrefix"), undefined],
          ] as const
        ).map(([key, label, lang]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <label htmlFor={`f-${key}`} className="text-sm font-semibold">
              {label}
            </label>
            <Input
              id={`f-${key}`}
              lang={lang}
              required
              value={f[key]}
              onChange={(e) => setF({ ...f, [key]: key === "invoicePrefix" ? e.target.value.toUpperCase().replace(/[^A-Z]/g, "") : e.target.value })}
              className="h-12"
            />
          </div>
        ))}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">{t("language")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["ta", "en"] as const).map((l) => (
            <button key={l} type="button" lang={l} aria-pressed={f.defaultLanguage === l} className={chip(f.defaultLanguage === l)} onClick={() => setF({ ...f, defaultLanguage: l })}>
              {l === "ta" ? "தமிழ்" : "English"}
            </button>
          ))}
        </div>
      </fieldset>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={cn("rounded-xl px-3 py-2 font-medium", msg.ok ? "bg-accent" : "bg-destructive/10 text-destructive")}>
          {msg.text}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 self-start px-8 text-base" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  )
}

/** One staff member, with "new password" for when they're locked out (shown once). */
export function StaffRow({ tenantId, staff }: { tenantId: string; staff: { id: string; name: string; email: string | null; active: boolean; roles: string } }) {
  const t = useTranslations("admin")
  const te = useTranslations("errors")
  const [password, setPassword] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <li className={cn("flex flex-col gap-2 py-3", !staff.active && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{staff.name}</span>
          <span className="text-sm text-muted-foreground">
            {staff.roles}
            {staff.email && ` · ${staff.email}`}
            {!staff.active && ` · ${t("noAccess")}`}
          </span>
        </div>
        {staff.active && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null)
                const r = await resetPasswordAction(tenantId, staff.id)
                if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
                setPassword(r.password ?? null)
              })
            }
          >
            <KeyRound /> {t("newPassword")}
          </Button>
        )}
      </div>
      {password && (
        <p className="rounded-xl bg-yolk px-3 py-2 text-yolk-foreground">
          {t("tempPassword")}: <b className="font-mono text-lg select-all">{password}</b>
        </p>
      )}
      {password === null && <p className="text-sm text-muted-foreground">{t("demoNoPassword")}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  )
}

/** Adds an owner login (e.g. the first one went to someone who left, or a second family member). */
export function OwnerForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations("admin")
  const te = useTranslations("errors")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [o, setO] = useState({ name: "", email: "", phone: "" })
  const [result, setResult] = useState<{ ok: boolean; text: string; password?: string | null } | null>(null)
  const [pending, start] = useTransition()

  if (!open) {
    return (
      <Button type="button" variant="outline" className="self-start" onClick={() => setOpen(true)}>
        {t("addOwner")}
      </Button>
    )
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-dashed p-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await addOwnerAction({ tenantId, owner: { name: o.name, email: o.email, phone: o.phone || undefined } })
          if (!r.ok) return setResult({ ok: false, text: te.has(r.error) ? te(r.error) : te("generic") })
          setResult({ ok: true, text: t("ownerCanSignIn", { email: o.email }), password: r.password })
          router.refresh()
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Input aria-label={t("ownerName")} placeholder={t("ownerName")} required value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} className="h-12" />
        <Input aria-label={t("ownerEmail")} placeholder={t("ownerEmail")} required type="email" value={o.email} onChange={(e) => setO({ ...o, email: e.target.value })} className="h-12" />
        <Input aria-label={t("ownerPhone")} placeholder={t("ownerPhone")} type="tel" value={o.phone} onChange={(e) => setO({ ...o, phone: e.target.value })} className="h-12" />
      </div>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cn("rounded-xl px-3 py-2", result.ok ? "bg-accent" : "bg-destructive/10 text-destructive")}>
          {result.text}
          {result.password && (
            <>
              {" "}
              {t("tempPassword")}: <b className="font-mono select-all">{result.password}</b>
            </>
          )}
        </p>
      )}
      <Button type="submit" className="self-start" disabled={pending}>
        {t("addOwner")}
      </Button>
    </form>
  )
}
