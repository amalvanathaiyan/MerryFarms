"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { closeBatch, removeBatch } from "@/app/actions/batches"

/** Owner: change the batch, close it when it's finished (or reopen), or delete one added by mistake. */
export function BatchActions({ id, today, startDate, closedDate, closedText, canDelete }: { id: string; today: string; startDate: string; closedDate: string | null; closedText: string | null; canDelete: boolean }) {
  const t = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [closeOn, setCloseOn] = useState(today)

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {closedDate ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">{t("closedOn", { day: closedText ?? closedDate })}</p>
          <Button variant="outline" disabled={pending} onClick={() => run(() => closeBatch(id, null))}>
            {t("reopen")}
          </Button>
        </div>
      ) : closing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => closeBatch(id, closeOn), () => setClosing(false))
          }}
        >
          <p className="text-sm text-muted-foreground">{t("closeHint")}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold">
              {t("closeDate")}
              <Input type="date" min={startDate} max={today} value={closeOn} onChange={(e) => setCloseOn(e.target.value)} className="h-10 w-auto font-normal" />
            </label>
            <Button type="submit" disabled={pending}>
              {t("closeConfirm")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setClosing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/farm/records/batches/${id}/edit`}>
            <Pencil className="size-4" /> {t("edit")}
          </Link>
        </Button>
        {!closedDate && !closing && (
          <Button variant="outline" onClick={() => setClosing(true)}>
            {t("close")}
          </Button>
        )}
        {canDelete && (
          <Button
            variant="outline"
            className="text-destructive"
            disabled={pending}
            onClick={() => window.confirm(t("deleteConfirm")) && run(() => removeBatch(id), () => router.push("/farm/records"))}
          >
            <Trash2 className="size-4" /> {t("delete")}
          </Button>
        )}
      </div>
    </section>
  )
}
