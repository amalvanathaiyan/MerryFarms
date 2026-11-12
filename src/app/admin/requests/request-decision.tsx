"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { decideRequestAction } from "@/app/actions/platform-plans"

/** Approve or decline, with a short reply the farm sees. */
export function RequestDecision({ id }: { id: string }) {
  const t = useTranslations("admin.requests")
  const te = useTranslations("errors")
  const router = useRouter()
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const decide = (approve: boolean) =>
    start(async () => {
      setError(null)
      const r = await decideRequestAction(id, approve, reply || null)
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      router.refresh()
    })
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("reply")}</span>
        <Input value={reply} maxLength={500} onChange={(e) => setReply(e.target.value)} placeholder={t("replyHint")} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => decide(true)}>
          <Check /> {t("approve")}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => decide(false)}>
          <X /> {t("decline")}
        </Button>
      </div>
    </div>
  )
}
