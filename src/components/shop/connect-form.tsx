"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { connectAction } from "@/app/actions/shop"

/** A new visitor connects with name and mobile number; no password, no code. */
export function ConnectForm({ farmPhone }: { farmPhone: string }) {
  const t = useTranslations("my")
  const ts = useTranslations("shop")
  const te = useTranslations("errors")
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [known, setKnown] = useState(false)
  const [pending, start] = useTransition()

  if (known) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <p className="font-medium">{t("knownNumber")}</p>
        <Button asChild size="lg">
          <a href={`tel:${farmPhone}`}>
            <Phone /> {t("callFarm")}
          </a>
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await connectAction({ name, phone, language: locale === "en" ? "en" : "ta" })
          if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
          if (r.status === "known") return setKnown(true)
          router.refresh()
        })
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {ts("name")}
        <Input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {ts("phone")}
        <Input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 font-normal" />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {t("connect")}
      </Button>
      <p className="text-sm text-muted-foreground">{t("connectPrivacy")}</p>
    </form>
  )
}
