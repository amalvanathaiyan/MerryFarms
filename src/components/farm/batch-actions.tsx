"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { closeBatch, removeBatch } from "@/app/actions/batches"
import { formatRupees } from "@/domain/money"
import { useCheer } from "@/components/cheer"

/** What deleting a batch would take with it. */
export interface BatchFootprint {
  days: number
  lost: number
  doses: number
  costPaise: number
}

const same = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase()

/**
 * Owner: change the batch, close it when it's finished (or reopen), or delete it. A batch with nothing entered
 * deletes after one "are you sure"; one with days entered (a test or a duplicate) needs its name typed.
 */
export function BatchActions({
  id,
  name,
  today,
  startDate,
  closedDate,
  closedText,
  footprint,
}: {
  id: string
  name: string
  today: string
  startDate: string
  closedDate: string | null
  closedText: string | null
  footprint: BatchFootprint
}) {
  const t = useTranslations("farm.batches")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [closeOn, setCloseOn] = useState(today)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState("")
  const [keepCosts, setKeepCosts] = useState(false)
  const hasEntries = footprint.days > 0

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      else after?.()
    })
  const gone = () => router.push("/farm/poultry")

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
          <Button variant="outline" disabled={pending} onClick={() => run(() => closeBatch(id, null), () => cheer("batchSaved", { batch: name }))}>
            {t("reopen")}
          </Button>
        </div>
      ) : closing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => closeBatch(id, closeOn), () => (setClosing(false), cheer("batchClosed", { batch: name })))
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

      {deleting ? (
        <form
          className="flex flex-col gap-3 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => removeBatch(id, { confirmName: typed, keepCosts }), () => (cheer("deleted"), gone()))
          }}
        >
          <p className="font-bold text-destructive">{t("deleteTitle", { name })}</p>
          <ul className="list-disc pl-5 text-sm">
            <li>{t("deleteDays", { count: footprint.days })}</li>
            {footprint.lost > 0 && <li>{t("deleteLost", { count: footprint.lost })}</li>}
            {footprint.doses > 0 && <li>{t("deleteDoses", { count: footprint.doses })}</li>}
            {footprint.costPaise > 0 && <li>{keepCosts ? t("deleteCostsKept", { amount: formatRupees(footprint.costPaise) }) : t("deleteCosts", { amount: formatRupees(footprint.costPaise) })}</li>}
          </ul>
          <p className="text-sm">{t("deleteNoUndo")}</p>
          {footprint.costPaise > 0 && (
            <label className="flex items-start gap-2 text-sm font-medium">
              <input type="checkbox" checked={keepCosts} onChange={(e) => setKeepCosts(e.target.checked)} className="mt-0.5 size-5 accent-[hsl(var(--primary))]" />
              {t("deleteKeepCosts")}
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("deleteType", { name })}
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="h-12 font-normal" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={pending || !same(typed, name)}>
              <Trash2 className="size-4" /> {t("deleteForGood")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => (setDeleting(false), setTyped(""))}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/farm/poultry/batches/${id}/edit`}>
              <Pencil className="size-4" /> {t("edit")}
            </Link>
          </Button>
          {!closedDate && !closing && (
            <Button variant="outline" onClick={() => setClosing(true)}>
              {t("close")}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive"
            disabled={pending}
            onClick={() => {
              if (hasEntries) return setDeleting(true)
              if (window.confirm(footprint.costPaise > 0 ? t("deleteConfirmCosts", { amount: formatRupees(footprint.costPaise) }) : t("deleteConfirm"))) run(() => removeBatch(id, { keepCosts: false }), () => (cheer("deleted"), gone()))
            }}
          >
            <Trash2 className="size-4" /> {t("delete")}
          </Button>
        </div>
      )}
      {!deleting && hasEntries && <p className="text-xs text-muted-foreground">{t("deleteOrFinish")}</p>}
    </section>
  )
}
