"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { registerFarm } from "@/app/actions/auth"
import { suggestSlug } from "@/domain/tenants"

const FIELD = "flex flex-col gap-1.5 text-sm font-semibold"

/** A farm owner signs up: their farm, its web address and their own login, on one short page. */
export function RegisterForm({ domain }: { domain: string }) {
  const t = useTranslations("login")
  const te = useTranslations("errors")
  const locale = useLocale()
  const [f, setF] = useState({ ownerName: "", nameTa: "", nameEn: "", phone: "", slug: "", email: "", password: "" })
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [pending, start] = useTransition()

  if (emailSent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg bg-accent px-3 py-3">
          {t("registerCheckEmail", { email: f.email })}
        </p>
        <Link href="/login" className="text-center font-medium text-primary underline underline-offset-2">
          {t("backToSignIn")}
        </Link>
      </div>
    )
  }

  const message = (code: string) => (t.has(code) ? t(code) : te.has(code) ? te(code) : te("generic"))

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          // A farm that gives one name uses it for both languages until the owner changes it in Settings.
          const r = await registerFarm({ ...f, nameTa: f.nameTa || f.nameEn, defaultLanguage: locale === "en" ? "en" : "ta" })
          if ("error" in r) setError(message(r.error))
          else setEmailSent(true)
        })
      }}
    >
      <label className={FIELD}>
        {t("yourName")}
        <Input required autoComplete="name" value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} className="h-12 font-normal" />
      </label>
      <label className={FIELD}>
        {t("farmNameEn")}
        <Input
          required
          value={f.nameEn}
          onChange={(e) => setF({ ...f, nameEn: e.target.value, slug: slugTouched ? f.slug : suggestSlug(e.target.value) })}
          className="h-12 font-normal"
        />
      </label>
      <label className={FIELD}>
        {t("farmNameTa")}
        <Input value={f.nameTa} onChange={(e) => setF({ ...f, nameTa: e.target.value })} className="h-12 font-normal" />
      </label>
      <label className={FIELD}>
        {t("farmPhone")}
        <Input required type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="h-12 font-normal" />
      </label>
      <label className={FIELD}>
        {t("farmAddress")}
        <Input
          required
          autoCapitalize="none"
          value={f.slug}
          onChange={(e) => (setSlugTouched(true), setF({ ...f, slug: e.target.value.toLowerCase() }))}
          className="h-12 font-normal lowercase"
        />
        <span className="font-normal break-all text-muted-foreground">
          {f.slug || t("farmAddressExample")}.{domain}
        </span>
      </label>
      <label className={FIELD}>
        {t("email")}
        <Input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="h-12 font-normal" />
      </label>
      <label className={FIELD}>
        {t("password")}
        <Input required type="password" minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="h-12 font-normal" />
        <span className="font-normal text-muted-foreground">{t("passwordRule")}</span>
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {t("registerButton")}
      </Button>
      <Link href="/login" className="text-center font-medium text-primary underline underline-offset-2">
        {t("haveAccount")}
      </Link>
    </form>
  )
}
