"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check, CircleCheck, LocateFixed, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { applyAction } from "@/app/actions/applications"
import { applicationNumber, detailsProblem } from "@/domain/applications"
import { normaliseIndianMobile, formatIndianMobile } from "@/domain/phone"
import { cn } from "@/lib/utils"

type Module = { key: string; name: string; soon: boolean }
type PlanChoice = { id: string; name: string; price: string }

const field = "flex flex-col gap-1.5"
const label = "text-sm font-semibold"
const area = "rounded-xl border bg-card px-3 py-2 text-base"
const box = "flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5"
const chip = (on: boolean) => cn("flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold", on ? "border-primary bg-accent" : "bg-card hover:border-primary")

/**
 * Register your farm, in three short parts (you, your farm, your plan) and one agreement. Business details are
 * folded away: most small farms don't have them yet, and the team asks on the call. After sending, the farm sees its
 * number and that the team will call; no login is made until the farm is approved.
 */
export function JoinForm({ language, modules, plans, initialPlan }: { language: "ta" | "en"; modules: Module[]; plans: PlanChoice[]; initialPlan: string | null }) {
  const t = useTranslations("join")
  const te = useTranslations("errors")
  const [f, setF] = useState({ ownerName: "", phone: "", email: "", nameTa: "", nameEn: "", district: "", address: "", pincode: "", fssai: "", gstin: "", pan: "", message: "", website: "" })
  const [picked, setPicked] = useState<string[]>([])
  const [plan, setPlan] = useState<string | null>(initialPlan)
  const [where, setWhere] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle")
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ number: number; again: boolean } | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  const locate = () => {
    if (!navigator.geolocation) return setLocating("failed")
    setLocating("busy")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setWhere({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 })
        setLocating("idle")
      },
      () => setLocating("failed"),
      { enableHighAccuracy: true, timeout: 15_000 }
    )
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!normaliseIndianMobile(f.phone)) return setError(te("phone_invalid"))
    const problem = detailsProblem({ email: f.email.trim(), pincode: f.pincode.trim(), fssai: f.fssai.replace(/\s/g, ""), gstin: f.gstin.replace(/\s/g, "").toUpperCase(), pan: f.pan.replace(/\s/g, "").toUpperCase() })
    if (problem) return setError(te(`application_${problem}`))
    start(async () => {
      const r = await applyAction({ ...f, pincode: f.pincode.trim(), modules: picked, planId: plan, lat: where?.lat ?? null, lng: where?.lng ?? null, language, agreed })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      setDone({ number: r.number!, again: !!r.again })
      window.scrollTo({ top: 0 })
    })
  }

  if (done) {
    const phone = normaliseIndianMobile(f.phone)
    return (
      <section className="flex flex-col gap-3 rounded-3xl border-2 border-primary bg-card p-5" aria-live="polite">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <CircleCheck className="size-7 shrink-0 text-primary" aria-hidden /> {done.again ? t("againTitle") : t("doneTitle")}
        </h2>
        <p className="text-lg">{t("doneText", { phone: phone ? formatIndianMobile(phone) : f.phone })}</p>
        <p className="rounded-2xl bg-accent p-4">
          {t("yourNumber")} <span className="block font-mono text-2xl font-bold">{applicationNumber(done.number)}</span>
        </p>
        <p className="text-sm text-muted-foreground">{t("doneNext")}</p>
        <Button asChild variant="outline" size="lg" className="h-12 self-start">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {/* Bots fill every box; people never see this one */}
      <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off" aria-hidden className="pointer-events-none fixed top-0 -left-full size-px opacity-0" />

      <fieldset className={box}>
        <legend className="px-1 text-lg font-bold">{t("you")}</legend>
        <div className={field}>
          <label htmlFor="ownerName" className={label}>
            {t("ownerName")}
          </label>
          <Input id="ownerName" required maxLength={60} autoComplete="name" value={f.ownerName} onChange={set("ownerName")} className="h-12" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="phone" className={label}>
              {t("phone")}
            </label>
            <Input id="phone" required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={set("phone")} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="email" className={label}>
              {t("email")}
            </label>
            <Input id="email" required type="email" autoComplete="email" maxLength={120} value={f.email} onChange={set("email")} className="h-12" aria-describedby="email-hint" />
          </div>
        </div>
        <p id="email-hint" className="-mt-2 text-sm text-muted-foreground">
          {t("emailHint")}
        </p>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-lg font-bold">{t("farm")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="nameTa" className={label}>
              {t("nameTa")}
            </label>
            <Input id="nameTa" lang="ta" required maxLength={80} value={f.nameTa} onChange={set("nameTa")} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="nameEn" className={label}>
              {t("nameEn")}
            </label>
            <Input id="nameEn" lang="en" maxLength={80} value={f.nameEn} onChange={set("nameEn")} className="h-12" />
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(label, "mb-2")}>{t("whatYouFarm")}</legend>
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => {
              const on = picked.includes(m.key)
              return (
                <button key={m.key} type="button" aria-pressed={on} className={chip(on)} onClick={() => setPicked((x) => (on ? x.filter((k) => k !== m.key) : [...x, m.key]))}>
                  {on && <Check className="size-4" aria-hidden />}
                  {m.name}
                  {m.soon && <span className="text-xs font-normal text-muted-foreground">· {t("soon")}</span>}
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className={field}>
          <label htmlFor="address" className={label}>
            {t("address")}
          </label>
          <textarea id="address" required rows={2} maxLength={300} autoComplete="street-address" value={f.address} onChange={set("address")} className={area} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="district" className={label}>
              {t("district")}
            </label>
            <Input id="district" required maxLength={60} value={f.district} onChange={set("district")} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="pincode" className={label}>
              {t("pincode")}
            </label>
            <Input id="pincode" required inputMode="numeric" autoComplete="postal-code" maxLength={6} value={f.pincode} onChange={(e) => setF((x) => ({ ...x, pincode: e.target.value.replace(/\D/g, "") }))} className="h-12 max-w-40 tabular-nums" />
          </div>
        </div>
        {where ? (
          <p className="flex flex-wrap items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium">
            <CircleCheck className="size-4 text-primary" aria-hidden /> {t("locationAdded")}
            <button type="button" onClick={() => setWhere(null)} className="ml-auto flex min-h-10 items-center gap-1 rounded-full px-2 hover:text-destructive">
              <X className="size-4" aria-hidden /> {t("remove")}
            </button>
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <Button type="button" variant="outline" size="lg" className="h-12 self-start" onClick={locate} disabled={locating === "busy"}>
              <LocateFixed aria-hidden /> {locating === "busy" ? t("locating") : t("useLocation")}
            </Button>
            <p className={cn("text-sm", locating === "failed" ? "text-destructive" : "text-muted-foreground")}>{locating === "failed" ? t("locationFailed") : t("locationHint")}</p>
          </div>
        )}
      </fieldset>

      {plans.length > 0 && (
        <fieldset className={box}>
          <legend className="px-1 text-lg font-bold">{t("plan")}</legend>
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => (
              <button key={p.id} type="button" aria-pressed={plan === p.id} className={chip(plan === p.id)} onClick={() => setPlan(p.id)}>
                {plan === p.id && <Check className="size-4" aria-hidden />}
                {p.name} <span className="font-normal text-muted-foreground">· {p.price}</span>
              </button>
            ))}
            <button type="button" aria-pressed={plan === null} className={chip(plan === null)} onClick={() => setPlan(null)}>
              {plan === null && <Check className="size-4" aria-hidden />}
              {t("notSure")}
            </button>
          </div>
        </fieldset>
      )}

      <details className="group rounded-3xl border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold sm:px-5">
          {t("business")}
          <span className="text-sm font-normal text-muted-foreground">{t("optional")}</span>
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <p className="text-sm text-muted-foreground">{t("businessHint")}</p>
          <div className={field}>
            <label htmlFor="fssai" className={label}>
              {t("fssai")}
            </label>
            <Input id="fssai" inputMode="numeric" maxLength={20} value={f.fssai} onChange={set("fssai")} className="h-12 max-w-64 font-mono" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={field}>
              <label htmlFor="gstin" className={label}>
                GSTIN
              </label>
              <Input id="gstin" maxLength={20} value={f.gstin} onChange={(e) => setF((x) => ({ ...x, gstin: e.target.value.toUpperCase() }))} className="h-12 font-mono" />
            </div>
            <div className={field}>
              <label htmlFor="pan" className={label}>
                PAN
              </label>
              <Input id="pan" maxLength={12} value={f.pan} onChange={(e) => setF((x) => ({ ...x, pan: e.target.value.toUpperCase() }))} className="h-12 font-mono" />
            </div>
          </div>
          <div className={field}>
            <label htmlFor="message" className={label}>
              {t("message")}
            </label>
            <textarea id="message" rows={3} maxLength={500} value={f.message} onChange={set("message")} className={area} />
          </div>
        </div>
      </details>

      <label className="flex cursor-pointer items-start gap-3 rounded-3xl border bg-card p-4 sm:p-5">
        <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-6 shrink-0 accent-primary" />
        <span>
          {t.rich("agree", {
            seller: (c) => (
              <Link href="/legal/seller-agreement" target="_blank" className="font-semibold text-primary underline">
                {c}
              </Link>
            ),
            items: (c) => (
              <Link href="/legal/prohibited-items" target="_blank" className="font-semibold text-primary underline">
                {c}
              </Link>
            ),
          })}
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-14 bg-sun text-lg text-sun-foreground hover:bg-[hsl(45_100%_44%)]" disabled={pending || !agreed}>
        {pending ? t("sending") : t("send")}
      </Button>
      <p className="-mt-2 text-center text-sm text-muted-foreground">{t("sendHint")}</p>
    </form>
  )
}
