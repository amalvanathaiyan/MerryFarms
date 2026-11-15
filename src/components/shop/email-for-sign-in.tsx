"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { confirmLinkEmailAction, removeEmailAction, sendLinkEmailCodeAction } from "@/app/actions/sign-in"

/**
 * On "My orders", for a customer whose phone is proven: an email they can also sign in with (a code goes to it to
 * prove it). Shows the email once it's saved, with Remove (tap twice).
 */
export function EmailForSignIn({ email: saved }: { email: string | null }) {
  const t = useTranslations("signIn")
  const te = useTranslations("errors")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [sent, setSent] = useState(false)
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const fail = (r: { error: string; seconds?: number }) => setError(te.has(r.error) ? te(r.error, { seconds: r.seconds ?? 30 }) : te("generic"))

  const box = "flex flex-col gap-3 rounded-2xl border bg-card p-4"
  const errorBox = error && (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {error}
    </p>
  )

  if (saved) {
    return (
      <section className={box}>
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail aria-hidden className="size-5" /> {t("emailSaved")}
        </h2>
        <p className="break-all">{saved}</p>
        {errorBox}
        <Button
          type="button"
          variant={armed ? "destructive" : "outline"}
          className="self-start"
          disabled={pending}
          onClick={() =>
            armed
              ? start(async () => {
                  const r = await removeEmailAction()
                  if (!r.ok) return fail(r)
                  setArmed(false)
                  router.refresh()
                })
              : setArmed(true)
          }
        >
          {armed ? t("emailRemoveSure") : t("emailRemove")}
        </Button>
      </section>
    )
  }

  if (!open) {
    return (
      <section className={box}>
        <p className="text-sm text-muted-foreground">{t("emailAddHint")}</p>
        <Button type="button" variant="outline" className="self-start" onClick={() => setOpen(true)}>
          <Mail aria-hidden /> {t("emailAdd")}
        </Button>
      </section>
    )
  }

  return (
    <form
      className={box}
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          if (!sent) {
            const r = await sendLinkEmailCodeAction({ email })
            if (!r.ok) return fail(r)
            setDemoCode(r.demoCode ?? null)
            setSent(true)
            return
          }
          const r = await confirmLinkEmailAction({ email, code })
          if (!r.ok) return fail(r)
          setOpen(false)
          router.refresh()
        })
      }}
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Mail aria-hidden className="size-5" /> {t("emailAdd")}
      </h2>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("email")}
        <Input required type="email" inputMode="email" autoComplete="email" maxLength={120} disabled={sent} value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 font-normal" />
      </label>
      {sent && (
        <>
          <p className="text-sm">{t("emailCodeSent", { email })}</p>
          {demoCode && (
            <p className="rounded-lg bg-yolk p-3 text-sm text-yolk-foreground">
              {t("demoCode")} <b className="text-lg tracking-widest tabular-nums">{demoCode}</b>
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
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
              className="h-12 text-center text-xl font-semibold tracking-[0.4em] tabular-nums"
            />
          </label>
        </>
      )}
      {errorBox}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || (sent && code.length !== 6)}>
          {sent ? t("emailSave") : t("emailSend")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => (setOpen(false), setSent(false), setCode(""), setError(null))}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
