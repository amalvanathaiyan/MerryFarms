"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createFarmAction } from "@/app/actions/admin"
import { checkSlug, suggestInvoicePrefix, suggestSlug } from "@/domain/tenants"
import { cn } from "@/lib/utils"

const PLANS = ["free", "starter", "growth", "pro"] as const

/** Adds a farm and its owner's login. The subdomain and bill prefix follow the English name until changed by hand. */
export function NewFarmForm({ rootDomain }: { rootDomain: string | null }) {
  const t = useTranslations("admin")
  const te = useTranslations("errors")
  const [f, setF] = useState({
    nameTa: "",
    nameEn: "",
    slug: "",
    phone: "",
    defaultLanguage: "ta" as "ta" | "en",
    invoicePrefix: "",
    plan: "free" as (typeof PLANS)[number],
    trialDays: 30,
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
  })
  const [touched, setTouched] = useState({ slug: false, prefix: false })
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<{ id: string; password: string | null; email: string } | null>(null)
  const [pending, start] = useTransition()

  const setNameEn = (nameEn: string) =>
    setF((x) => ({ ...x, nameEn, slug: touched.slug ? x.slug : suggestSlug(nameEn), invoicePrefix: touched.prefix ? x.invoicePrefix : suggestInvoicePrefix(nameEn) }))
  const slugProblem = f.slug ? checkSlug(f.slug) : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    start(async () => {
      const r = await createFarmAction({
        nameTa: f.nameTa,
        nameEn: f.nameEn,
        slug: f.slug,
        phone: f.phone,
        defaultLanguage: f.defaultLanguage,
        invoicePrefix: f.invoicePrefix,
        plan: f.plan,
        trialDays: f.trialDays,
        owner: { name: f.ownerName, email: f.ownerEmail, phone: f.ownerPhone || undefined },
      })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      setMade({ id: r.id!, password: r.password ?? null, email: f.ownerEmail })
    })
  }

  if (made) {
    return (
      <section className="flex flex-col gap-4 rounded-3xl border-2 border-primary bg-card p-5" aria-live="polite">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Check className="size-6 text-primary" aria-hidden /> {t("farmAdded", { name: f.nameEn })}
        </h2>
        <p>{t("ownerCanSignIn", { email: made.email })}</p>
        {made.password && (
          <div className="rounded-2xl bg-yolk p-4 text-yolk-foreground">
            <div className="text-sm font-medium">{t("tempPassword")}</div>
            <div className="font-mono text-2xl font-bold tracking-wide select-all">{made.password}</div>
            <p className="mt-1 text-sm">{t("tempPasswordHint")}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/admin/farms/${made.id}`}>{t("manage")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin">{t("farms")}</Link>
          </Button>
        </div>
      </section>
    )
  }

  const field = "flex flex-col gap-1.5"
  const label = "text-sm font-semibold"
  const chip = (on: boolean) => cn("rounded-full border px-4 py-2 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
        <legend className="px-1 text-lg font-bold">{t("farmDetails")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="nameTa" className={label}>
              {t("nameTa")}
            </label>
            <Input id="nameTa" lang="ta" required value={f.nameTa} onChange={(e) => setF({ ...f, nameTa: e.target.value })} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="nameEn" className={label}>
              {t("nameEn")}
            </label>
            <Input id="nameEn" lang="en" required value={f.nameEn} onChange={(e) => setNameEn(e.target.value)} className="h-12" />
          </div>
        </div>
        <div className={field}>
          <label htmlFor="slug" className={label}>
            {t("slug")}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="slug"
              required
              value={f.slug}
              onChange={(e) => {
                setTouched((x) => ({ ...x, slug: true }))
                setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
              }}
              className="h-12 max-w-56 font-mono"
              aria-describedby="slug-hint"
            />
            {rootDomain && <span className="text-muted-foreground">.{rootDomain}</span>}
          </div>
          <p id="slug-hint" className={cn("text-sm", slugProblem ? "text-destructive" : "text-muted-foreground")}>
            {slugProblem ? te(slugProblem) : t("slugHint")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="phone" className={label}>
              {t("farmPhone")}
            </label>
            <Input id="phone" required type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="prefix" className={label}>
              {t("invoicePrefix")}
            </label>
            <Input
              id="prefix"
              required
              maxLength={5}
              value={f.invoicePrefix}
              onChange={(e) => {
                setTouched((x) => ({ ...x, prefix: true }))
                setF({ ...f, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })
              }}
              className="h-12 max-w-32 font-mono"
            />
            <p className="text-sm text-muted-foreground">{t("invoicePrefixHint", { example: `${f.invoicePrefix || "MF"}/2026-27/0001` })}</p>
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className={label}>{t("language")}</legend>
          <div className="flex flex-wrap gap-2">
            {(["ta", "en"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={f.defaultLanguage === l} className={chip(f.defaultLanguage === l)} onClick={() => setF({ ...f, defaultLanguage: l })} lang={l}>
                {l === "ta" ? "தமிழ்" : "English"}
              </button>
            ))}
          </div>
        </fieldset>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
        <legend className="px-1 text-lg font-bold">{t("planAndTrial")}</legend>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <button key={p} type="button" aria-pressed={f.plan === p} className={chip(f.plan === p)} onClick={() => setF({ ...f, plan: p })}>
              {t(`plan_${p}`)}
            </button>
          ))}
        </div>
        <div className={field}>
          <label htmlFor="trial" className={label}>
            {t("trialDays")}
          </label>
          <Input id="trial" type="number" inputMode="numeric" min={0} max={365} value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })} className="h-12 max-w-32" />
          <p className="text-sm text-muted-foreground">{t("trialDaysHint")}</p>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:p-5">
        <legend className="px-1 text-lg font-bold">{t("owner")}</legend>
        <p className="-mt-2 text-sm text-muted-foreground">{t("ownerHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={field}>
            <label htmlFor="ownerName" className={label}>
              {t("ownerName")}
            </label>
            <Input id="ownerName" required value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="ownerEmail" className={label}>
              {t("ownerEmail")}
            </label>
            <Input id="ownerEmail" required type="email" autoComplete="off" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} className="h-12" />
          </div>
          <div className={field}>
            <label htmlFor="ownerPhone" className={label}>
              {t("ownerPhone")}
            </label>
            <Input id="ownerPhone" type="tel" inputMode="tel" value={f.ownerPhone} onChange={(e) => setF({ ...f, ownerPhone: e.target.value })} className="h-12" />
          </div>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-14 text-lg" disabled={pending || !!slugProblem}>
        {pending ? t("adding") : t("addFarm")}
      </Button>
    </form>
  )
}
