"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveAccount } from "@/app/actions/account"

const FIELD = "flex flex-col gap-1.5 text-sm font-semibold"

export function AccountForm(props: { name: string; staffCode: string | null; email: string | null; canChangePassword: boolean }) {
  const t = useTranslations("farm.account")
  const tl = useTranslations("login")
  const tc = useTranslations("common")
  const [name, setName] = useState(props.name)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setResult(null)
        start(async () => {
          const r = await saveAccount({ name, currentPassword: current || undefined, newPassword: next || undefined })
          if (r.error) return setResult({ ok: false, text: tl.has(r.error) ? tl(r.error) : tl("generic") })
          setCurrent("")
          setNext("")
          setResult({ ok: true, text: t("saved") })
        })
      }}
    >
      <dl className="flex flex-col gap-1 text-sm">
        {props.staffCode && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{tl("staffId")}</dt>
            <dd className="font-semibold tracking-wider">{props.staffCode}</dd>
          </div>
        )}
        {props.email && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{tl("email")}</dt>
            <dd className="min-w-0 truncate font-semibold">{props.email}</dd>
          </div>
        )}
      </dl>
      <label className={FIELD}>
        {t("name")}
        <Input required value={name} onChange={(e) => setName(e.target.value)} className="h-12 font-normal" />
      </label>
      {props.canChangePassword && (
        <>
          <h2 className="font-semibold">{t("changePassword")}</h2>
          <label className={FIELD}>
            {t("currentPassword")}
            <Input type="password" autoComplete="current-password" required={!!next} value={current} onChange={(e) => setCurrent(e.target.value)} className="h-12 font-normal" />
          </label>
          <label className={FIELD}>
            {tl("newPassword")}
            <Input type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} className="h-12 font-normal" />
            <span className="font-normal text-muted-foreground">{tl("passwordRule")}</span>
          </label>
        </>
      )}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={result.ok ? "rounded-lg bg-accent px-3 py-2" : "rounded-lg bg-destructive/10 px-3 py-2 text-destructive"}>
          {result.text}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {tc("save")}
      </Button>
    </form>
  )
}
