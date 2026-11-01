"use client"

import { useEffect, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { openRecoveryLink, setNewPassword } from "@/app/actions/auth"

export function NewPasswordForm() {
  const t = useTranslations("login")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    const link = new URLSearchParams(window.location.hash.slice(1))
    const access_token = link.get("access_token")
    const refresh_token = link.get("refresh_token")
    if (!access_token && !link.get("error")) return
    window.history.replaceState(null, "", window.location.pathname)
    start(async () => {
      const r = access_token && refresh_token ? await openRecoveryLink({ access_token, refresh_token }) : { error: "link_expired" }
      if (r.error) setError(t(r.error))
    })
  }, [t])

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await setNewPassword(password)
          if (r?.error) setError(t.has(r.error) ? t(r.error) : t("generic"))
        })
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("newPassword")}
        <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 font-normal" />
        <span className="font-normal text-muted-foreground">{t("passwordRule")}</span>
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {t("savePassword")}
      </Button>
    </form>
  )
}
