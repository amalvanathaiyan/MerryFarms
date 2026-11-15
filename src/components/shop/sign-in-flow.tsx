"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, MessageCircle } from "lucide-react"
import { checkCodeAction, checkEmailCodeAction, checkWhatsAppAction, registerAction, sendCodeAction, sendEmailCodeAction, startSignInAction } from "@/app/actions/sign-in"
import { formatIndianMobile, normaliseIndianMobile } from "@/domain/phone"

type Step = "phone" | "whatsapp" | "email" | "code" | "register"

/**
 * Mobile number → proof it's theirs → (new customers only) name and address.
 * The proof, free first: they send us a code on WhatsApp and come back (signed in by itself); otherwise a code we
 * send them, typed in; or, for a number without WhatsApp, a code to their email (it proves the email, not the phone:
 * a number the farm already knows can't be opened that way). Nothing to remember: after this the phone keeps them
 * signed in.
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
  const [reg, setReg] = useState({ name: "", addressLine: "", landmark: "", pincode: "", offers: false })
  const [error, setError] = useState<string | null>(null)
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(0)
  const [pending, start] = useTransition()
  const [wa, setWa] = useState<{ link: string; code: string; number: string; canSendCode: boolean; over: boolean } | null>(null)
  const checking = useRef(false)
  // Where the typed code came from, the email it went to, and whether email codes can be sent.
  const [via, setVia] = useState<"phone" | "email">("phone")
  const [email, setEmail] = useState("")
  const [canEmail, setCanEmail] = useState(false)

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
  // New to this farm but known to Farm For You: their name is filled in for them.
  const fillKnown = (known: { name: string } | null) => known && setReg((x) => ({ ...x, name: x.name || known.name }))

  // Away on WhatsApp: ask every few seconds, and at once when they come back to this screen.
  useEffect(() => {
    if (step !== "whatsapp" || wa?.over) return
    const check = async () => {
      if (checking.current || document.visibilityState !== "visible") return
      checking.current = true
      try {
        const r = await checkWhatsAppAction()
        if (!r.ok) {
          setWa((w) => (w ? { ...w, over: true } : w))
          setError(te.has(r.error) ? te(r.error) : te("generic"))
        } else if (r.next === "done") finish()
        else if (r.next === "register") {
          fillKnown(r.known)
          setStep("register")
        }
      } catch {
        // A dropped connection: the next tick tries again.
      } finally {
        checking.current = false
      }
    }
    const id = setInterval(check, 3000)
    document.addEventListener("visibilitychange", check)
    window.addEventListener("focus", check)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", check)
      window.removeEventListener("focus", check)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, wa?.over])

  const begin = () =>
    start(async () => {
      setError(null)
      const r = await startSignInAction({ phone, language: lang })
      if (!r.ok) return fail(r)
      if (r.way === "email") {
        setCanEmail(true)
        setStep("email")
        return
      }
      setCanEmail(r.canEmail)
      if (r.way === "whatsapp") {
        setWa({ link: r.link, code: r.code, number: r.number, canSendCode: r.canSendCode, over: false })
        setStep("whatsapp")
        return
      }
      codeSent("phone", r.demoCode)
    })

  const codeSent = (from: "phone" | "email", demo?: string) => {
    setVia(from)
    setDemoCode(demo ?? null)
    setCode("")
    setStep("code")
    setNow(Date.now())
    setWaitUntil(Date.now() + 30_000)
  }

  const sendEmail = () =>
    start(async () => {
      setError(null)
      const r = await sendEmailCodeAction({ phone, email })
      if (!r.ok) return fail(r)
      codeSent("email", r.demoCode)
    })

  const emailInstead = canEmail && (
    <Button type="button" variant="ghost" disabled={pending} onClick={() => (setError(null), setStep("email"))}>
      {t("emailInstead")}
    </Button>
  )

  const send = () =>
    start(async () => {
      setError(null)
      const r = await sendCodeAction({ phone, language: lang })
      if (!r.ok) return fail(r)
      codeSent("phone", r.demoCode)
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
          begin()
        }}
      >
        <label className={label}>
          {ts("phone")}
          <Input required type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-lg font-normal tabular-nums" />
        </label>
        {errorBox}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {t("next")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("phoneHint")}</p>
      </form>
    )
  }

  if (step === "whatsapp" && wa) {
    const normal = normaliseIndianMobile(phone)
    const shown = normal ? formatIndianMobile(normal) : phone
    const again = () => (setStep("phone"), setWa(null), setError(null))
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("waTitle")}</h2>
        {/* Steps are plain text, not buttons: only the green button is tapped. */}
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-base">
          <li>{t("waStep1")}</li>
          <li>{t("waStep2")}</li>
          <li>{t("waStep3")}</li>
        </ol>
        <p className="text-sm">
          {t("waFrom", { phone: shown })}{" "}
          <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={again}>
            {t("changeNumber")}
          </button>
        </p>
        {wa.over ? (
          <>
            {errorBox}
            <Button type="button" size="lg" className="h-12 text-base" onClick={again}>
              {t("startAgain")}
            </Button>
          </>
        ) : (
          <>
            <a
              href={wa.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-sec-whatsapp px-4 text-lg font-semibold text-sec-on hover:bg-sec-whatsapp/90"
            >
              <MessageCircle aria-hidden className="size-6" /> {t("waButton")}
            </a>
            <p role="status" className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> {t("waWaiting")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("waManual", { code: wa.code, number: wa.number ? formatIndianMobile(`+${wa.number}`) : "" })}
            </p>
          </>
        )}
        {wa.canSendCode && (
          <Button type="button" variant="ghost" disabled={pending} onClick={send}>
            {t("smsInstead")}
          </Button>
        )}
        {emailInstead}
      </div>
    )
  }

  if (step === "email") {
    const normal = normaliseIndianMobile(phone)
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          sendEmail()
        }}
      >
        <h2 className="text-lg font-semibold">{t("emailTitle")}</h2>
        <p className="text-sm">
          {t("emailHint", { phone: normal ? formatIndianMobile(normal) : phone })}{" "}
          <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => (setStep("phone"), setError(null))}>
            {t("changeNumber")}
          </button>
        </p>
        <label className={label}>
          {t("email")}
          <Input required autoFocus type="email" inputMode="email" autoComplete="email" maxLength={120} value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 font-normal" />
        </label>
        {errorBox}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {t("emailSend")}
        </Button>
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
            const r = via === "email" ? await checkEmailCodeAction({ phone, email, code }) : await checkCodeAction({ phone, code })
            if (!r.ok) return fail(r)
            if (r.next === "register") {
              fillKnown(r.known)
              setStep("register")
            }
            else finish()
          })
        }}
      >
        <p>
          {via === "email" ? t("emailCodeSent", { email }) : t("codeSent", { phone: normal ? formatIndianMobile(normal) : phone })}{" "}
          <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => (setStep(via === "email" ? "email" : "phone"), setError(null))}>
            {via === "email" ? t("changeEmail") : t("changeNumber")}
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
        <Button type="button" variant="ghost" disabled={pending || waitLeft > 0} onClick={via === "email" ? sendEmail : send}>
          {waitLeft > 0 ? t("resendIn", { seconds: waitLeft }) : t("resend")}
        </Button>
        {via === "phone" && emailInstead}
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
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--primary))]" checked={reg.offers} onChange={(e) => setReg({ ...reg, offers: e.target.checked })} />
        <span>{t("offers")}</span>
      </label>
      {errorBox}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {t("register")}
      </Button>
    </form>
  )
}
