"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signIn } from "@/app/actions/auth"
import { cn } from "@/lib/utils"

const FIELD = "flex flex-col gap-1.5 text-sm font-semibold"

/** Owners sign in with email and password; staff with their Staff ID and password, as on Hotelier-4U. */
export function LoginForm({ next, forAdmin, farmKnown }: { next: string; forAdmin: boolean; farmKnown: boolean }) {
  const t = useTranslations("login")
  const [mode, setMode] = useState<"email" | "staff">("email")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const value = (name: string) => String(form.get(name) ?? "")
    start(async () => {
      const r = await signIn({ mode, email: value("email"), farm: value("farm"), staffId: value("staffId"), password: value("password"), next })
      if (r?.error) setError(t.has(r.error) ? t(r.error) : t("wrong_login"))
    })
  }

  const tab = (m: "email" | "staff", label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => (setMode(m), setError(null))}
      className={cn("min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors", mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-4">
      {!forAdmin && (
        <div className="flex gap-1 rounded-xl border bg-card p-1">
          {tab("email", t("tabOwner"))}
          {tab("staff", t("tabStaff"))}
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "email" ? (
          <label className={FIELD}>
            {t("email")}
            <Input name="email" type="email" required autoComplete="email" className="h-12 font-normal" />
          </label>
        ) : (
          <>
            {!farmKnown && (
              <label className={FIELD}>
                {t("farmId")}
                <Input name="farm" required autoCapitalize="none" autoComplete="off" className="h-12 font-normal lowercase" />
                <span className="font-normal text-muted-foreground">{t("farmIdHint")}</span>
              </label>
            )}
            <label className={FIELD}>
              {t("staffId")}
              <Input name="staffId" required autoCapitalize="characters" autoComplete="username" className="h-12 font-normal uppercase tracking-wider" />
              <span className="font-normal text-muted-foreground">{t("staffIdHint")}</span>
            </label>
          </>
        )}
        <label className={FIELD}>
          {t("password")}
          <Input name="password" type="password" required autoComplete="current-password" className="h-12 font-normal" />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {t("signIn")}
        </Button>
      </form>
      {mode === "email" ? (
        <div className="flex flex-col gap-2 text-center">
          <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2">
            {t("forgot")}
          </Link>
          {!forAdmin && (
            <Link href="/register" className="font-medium text-primary underline underline-offset-2">
              {t("registerLink")}
            </Link>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">{t("staffForgot")}</p>
      )}
    </div>
  )
}
