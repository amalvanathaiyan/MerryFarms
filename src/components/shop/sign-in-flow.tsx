"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { checkCodeAction, registerAction, sendCodeAction } from "@/app/actions/sign-in"
import { formatIndianMobile, normaliseIndianMobile } from "@/domain/phone"

type Step = "phone" | "code" | "register"

/**
 * Mobile number → one-time code → (new customers only) name and address.
 * Nothing to remember: after this the phone keeps them signed in.
 */
export function SignInFlow({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("signIn")
  const ts = useTranslations("shop")
  const te = useTranslations("errors")
  const locale = useLocale()
  const lang = locale === "en" ? "en" : "ta"
  const router = useRouter()
  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [reg, setReg] = useState({ name: "", addressLine: "", landmark: "", pincode: "" })
  const [error, setError] = useState<string | null>(null)
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(0)
  const [pending, start] = useTransition()

  // Countdown for "send again".
  useEffect(() => {
    if (!waitUntil) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [waitUntil])
  const waitLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000))

  const fail = (r: { error: string; seconds?: number }) => {
    if (r.error === "otp_wait" && r.seconds) {
      setNow(Date.now())
      setWaitUntil(Date.now() + r.seconds * 1000)
    }
    setError(te.has(r.error) ? te(r.error, { seconds: r.seconds ?? 30 }) : te("generic"))
  }

  const finish = () => (onDone ? onDone() : router.refresh())

  const send = () =>
    start(async () => {
      setError(null)
      const r = await sendCodeAction({ phone, language: lang })
      if (!r.ok) return fail(r)
      setDemoCode(r.demoCode ?? null)
      setCode("")
      setStep("code")
      setNow(Date.now())
      setWaitUntil(Date.now() + 30_000)
    })

  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
      {error}
    </p>
  )
  const label = "flex flex-col gap-1.5 text-sm font-semibold"

  if (step === "phone") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!normaliseIndianMobile(phone)) return setError(te("phone_invalid"))
          send()
        }}
      >
        <label className={label}>
          {ts("phone")}
          <Input required type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-lg font-normal tabular-nums" />
        </label>
        {errorBox}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {t("sendCode")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("phoneHint")}</p>
      </form>
    )
  }

  if (step === "code") {
    const normal = normaliseIndianMobile(phone)
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            setError(null)
            const r = await checkCodeAction({ phone, code })
            if (!r.ok) return fail(r)
            if (r.next === "register") setStep("register")
            else finish()
          })
        }}
      >
        <p>
          {t("codeSent", { phone: normal ? formatIndianMobile(normal) : phone })}{" "}
          <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => (setStep("phone"), setError(null))}>
            {t("changeNumber")}
          </button>
        </p>
        {demoCode && (
          <p className="rounded-lg bg-yolk p-3 text-sm text-yolk-foreground">
            {t("demoCode")} <b className="text-lg tracking-widest tabular-nums">{demoCode}</b>
          </p>
        )}
        <label className={label}>
          {t("code")}
          <Input
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-14 text-center text-2xl font-semibold tracking-[0.5em] tabular-nums"
          />
        </label>
        {errorBox}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending || code.length !== 6}>
          {t("verify")}
        </Button>
        <Button type="button" variant="ghost" disabled={pending || waitLeft > 0} onClick={send}>
          {waitLeft > 0 ? t("resendIn", { seconds: waitLeft }) : t("resend")}
        </Button>
      </form>
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const r = await registerAction({ ...reg, language: lang })
          if (!r.ok) {
            if (r.error === "otp_verify_again") setStep("phone")
            return fail(r)
          }
          finish()
        })
      }}
    >
      <div>
        <h2 className="text-lg font-semibold">{t("registerTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("registerHint")}</p>
      </div>
      <label className={label}>
        {ts("name")}
        <Input required autoComplete="name" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} className="h-12 font-normal" />
      </label>
      <label className={label}>
        {ts("address")} <span className="font-normal text-muted-foreground">({t("optional")})</span>
        <textarea
          rows={2}
          autoComplete="street-address"
          value={reg.addressLine}
          onChange={(e) => setReg({ ...reg, addressLine: e.target.value })}
          className="rounded-md border border-input bg-transparent px-3 py-2 text-base font-normal shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          {ts("landmark")}
          <Input value={reg.landmark} onChange={(e) => setReg({ ...reg, landmark: e.target.value })} className="h-12 font-normal" />
        </label>
        <label className={label}>
          {t("pincode")}
          <Input inputMode="numeric" maxLength={6} autoComplete="postal-code" value={reg.pincode} onChange={(e) => setReg({ ...reg, pincode: e.target.value.replace(/\D/g, "") })} className="h-12 font-normal tabular-nums" />
        </label>
      </div>
      {errorBox}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {t("register")}
      </Button>
    </form>
  )
}
