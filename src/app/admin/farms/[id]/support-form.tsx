"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { LifeBuoy } from "lucide-react"
import { startSupportAction } from "@/app/actions/support"
import { Button } from "@/components/ui/button"

/**
 * Open this farm's app in support mode. A reason is required: the farm admin sees it in their log. The visit lasts
 * an hour, every change is recorded, and farm logins stay closed.
 */
export function SupportForm({ tenantId }: { tenantId: string }) {
  const t = useTranslations("admin.support")
  const te = useTranslations("errors")
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <form
      className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await startSupportAction({ tenantId, reason })
          if (r?.error) setError(te.has(r.error) ? te(r.error) : te("generic"))
        })
      }}
    >
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-5 shrink-0 text-primary" aria-hidden />
        <h2 className="text-lg font-bold">{t("title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
      <label htmlFor="support-reason" className="text-sm font-semibold">
        {t("reason")}
      </label>
      <textarea
        id="support-reason"
        required
        minLength={3}
        maxLength={300}
        rows={2}
        value={reason}
        placeholder={t("reasonPlaceholder")}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-xl border bg-background px-3 py-2 text-base"
      />
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 font-medium text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="self-start" disabled={pending || reason.trim().length < 3}>
        <LifeBuoy /> {pending ? t("opening") : t("open")}
      </Button>
    </form>
  )
}
