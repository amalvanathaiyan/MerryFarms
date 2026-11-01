"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { sendPasswordReset } from "@/app/actions/auth"

/** Owners get a reset link by email. Staff with a Staff ID ask their owner for a new password instead. */
export default function ForgotPasswordPage() {
  const t = useTranslations("login")
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-5 px-4 py-8">
      <h1 className="text-2xl font-bold">{t("forgotTitle")}</h1>
      {sent ? (
        <p role="status" className="rounded-lg bg-accent px-3 py-3">
          {t("forgotSent")}
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            start(async () => {
              const r = await sendPasswordReset(email)
              if (r.error) setError(t.has(r.error) ? t(r.error) : t("generic"))
              else setSent(true)
            })
          }}
        >
          <p className="text-muted-foreground">{t("forgotHint")}</p>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("email")}
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 font-normal" />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
            {t("forgotSend")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">{t("staffForgot")}</p>
        </form>
      )}
      <Link href="/login" className="text-center font-medium text-primary underline underline-offset-2">
        {t("backToSignIn")}
      </Link>
    </main>
  )
}
