"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

/** Staff sign-in with email and password (free on Supabase; no SMS provider needed). */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(false)
  const [pending, start] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(false)
    start(async () => {
      const { error } = await createClient().auth.signInWithPassword({ email, password })
      if (error) {
        setError(true)
        return
      }
      router.replace(next)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("email")}
        <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {t("password")}
        <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 font-normal" />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
          {t("error")}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {t("signIn")}
      </Button>
    </form>
  )
}
