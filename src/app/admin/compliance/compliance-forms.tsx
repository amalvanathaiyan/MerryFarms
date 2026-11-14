"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addStarterItemsAction, decideCaseAction, removeItemAction, saveComplianceConfigAction, saveItemAction } from "@/app/actions/compliance"
import { RESTRICTED_ACTIONS, type CaseDecision, type ComplianceConfig } from "@/domain/compliance"
import { cn } from "@/lib/utils"

const area = "rounded-xl border bg-card px-3 py-2 text-base"
const chip = (on: boolean) => cn("flex min-h-11 items-center rounded-full border-2 px-4 text-sm font-semibold", on ? "border-primary bg-accent" : "bg-card hover:border-primary")

function useAction() {
  const te = useTranslations("errors")
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      after?.()
      router.refresh()
    })
  return { pending, error, run }
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="font-medium text-destructive">
      {text}
    </p>
  ) : null
}

/** The screening switch (off until the list is checked by a legal expert) and the repeat-offence count. */
export function ScreeningSettings({ initial }: { initial: ComplianceConfig }) {
  const t = useTranslations("admin.compliance")
  const [c, setC] = useState(initial)
  const [saved, setSaved] = useState(false)
  const { pending, error, run } = useAction()
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={c.on} onChange={(e) => (setC({ ...c, on: e.target.checked }), setSaved(false))} className="mt-0.5 size-6 shrink-0 accent-primary" />
        <span>
          <span className="block font-semibold">{t("switchOn")}</span>
          <span className="block text-sm text-muted-foreground">{t("switchHint")}</span>
        </span>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("repeatLimit")}</span>
        <Input type="number" min={1} max={20} value={c.repeatLimit} onChange={(e) => (setC({ ...c, repeatLimit: Math.max(1, Math.min(20, Number(e.target.value) || 1)) }), setSaved(false))} className="h-12 max-w-24" />
        <span className="text-sm text-muted-foreground">{t("repeatHint")}</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" className="h-12" disabled={pending} onClick={() => run(() => saveComplianceConfigAction(c), () => setSaved(true))}>
          {t("save")}
        </Button>
        {saved && (
          <span role="status" className="font-medium text-primary">
            {t("saved")}
          </span>
        )}
      </div>
      <ErrorLine text={error} />
    </div>
  )
}

/**
 * Farm For You's decision on a case: allow it, keep it hidden, or remove the product, with a note the farm sees.
 * A case kept hidden can still be allowed later.
 */
export function CaseDecisionForm({ id, kind, status }: { id: string; kind: string; status: string }) {
  const t = useTranslations("admin.compliance")
  const [note, setNote] = useState("")
  const [armed, setArmed] = useState<CaseDecision | null>(null)
  const { pending, error, run } = useAction()
  const choices: CaseDecision[] = status === "kept_hidden" ? ["allowed"] : kind === "product" ? ["allowed", "kept_hidden", "removed"] : ["allowed", "kept_hidden"]
  const decide = (d: CaseDecision) => run(() => decideCaseAction({ id, decision: d, note: note.trim() || null }), () => setArmed(null))
  return (
    <div className="flex flex-col gap-2">
      {status === "open" && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{t("note")}</span>
          <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className={area} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {choices.map((d) =>
          d === "removed" && armed === "removed" ? (
            <Button key={d} type="button" variant="destructive" className="h-11" disabled={pending} onClick={() => decide(d)}>
              {t("removeSure")}
            </Button>
          ) : (
            <Button
              key={d}
              type="button"
              variant={d === "allowed" ? "outline" : d === "removed" ? "outline" : "default"}
              className={cn("h-11", d === "removed" && "text-destructive hover:text-destructive")}
              disabled={pending}
              onClick={() => (d === "removed" ? setArmed("removed") : decide(d))}
            >
              {t(kind === "category" && d === "kept_hidden" ? "noted" : `decide_${d}`)}
            </Button>
          )
        )}
      </div>
      <ErrorLine text={error} />
    </div>
  )
}

export interface ItemRow {
  id: string
  labelTa: string
  labelEn: string
  wordsTa: string[]
  wordsEn: string[]
  action: string
  reasonTa: string
  reasonEn: string
  active: boolean
}

/** Adds or changes one entry of the restricted items list. Words are separated by commas. */
export function ItemForm({ item, onDone }: { item: ItemRow | null; onDone?: () => void }) {
  const t = useTranslations("admin.compliance")
  const [f, setF] = useState({
    labelTa: item?.labelTa ?? "",
    labelEn: item?.labelEn ?? "",
    wordsTa: item?.wordsTa.join(", ") ?? "",
    wordsEn: item?.wordsEn.join(", ") ?? "",
    action: item?.action ?? "hold",
    reasonTa: item?.reasonTa ?? "",
    reasonEn: item?.reasonEn ?? "",
    active: item?.active ?? true,
  })
  const [armed, setArmed] = useState(false)
  const { pending, error, run } = useAction()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => saveItemAction({ id: item?.id ?? null, ...f }), onDone)
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("labelTa")}</span>
          <Input lang="ta" required maxLength={80} value={f.labelTa} onChange={set("labelTa")} className="h-12" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("labelEn")}</span>
          <Input required maxLength={80} value={f.labelEn} onChange={set("labelEn")} className="h-12" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("wordsTa")}</span>
          <textarea rows={2} lang="ta" value={f.wordsTa} onChange={set("wordsTa")} className={area} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("wordsEn")}</span>
          <textarea rows={2} value={f.wordsEn} onChange={set("wordsEn")} className={area} />
        </label>
      </div>
      <p className="-mt-1 text-sm text-muted-foreground">{t("wordsHint")}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t("action")}</legend>
        <div className="flex flex-wrap gap-2">
          {RESTRICTED_ACTIONS.map((a) => (
            <button key={a} type="button" aria-pressed={f.action === a} className={chip(f.action === a)} onClick={() => setF((x) => ({ ...x, action: a }))}>
              {t(`action_${a}`)}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{t(`action_${f.action}_hint`)}</p>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("reasonTa")}</span>
          <textarea rows={2} lang="ta" required maxLength={300} value={f.reasonTa} onChange={set("reasonTa")} className={area} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("reasonEn")}</span>
          <textarea rows={2} required maxLength={300} value={f.reasonEn} onChange={set("reasonEn")} className={area} />
        </label>
      </div>
      <p className="-mt-1 text-sm text-muted-foreground">{t("reasonHint")}</p>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} className="size-6 accent-primary" />
        <span className="font-semibold">{t("active")}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12" disabled={pending}>
          {item ? t("saveItem") : t("addItem")}
        </Button>
        {item &&
          (armed ? (
            <Button type="button" variant="destructive" className="h-12" disabled={pending} onClick={() => run(() => removeItemAction(item.id))}>
              {t("removeItemSure")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="h-12 text-destructive hover:text-destructive" onClick={() => setArmed(true)}>
              {t("removeItem")}
            </Button>
          ))}
      </div>
      <ErrorLine text={error} />
    </form>
  )
}

/** A new entry, folded until wanted. */
export function NewItem() {
  const t = useTranslations("admin.compliance")
  const [open, setOpen] = useState(false)
  return open ? (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary bg-card p-4">
      <h2 className="text-lg font-bold">{t("newItem")}</h2>
      <ItemForm item={null} onDone={() => setOpen(false)} />
      <Button type="button" variant="ghost" className="h-11 self-start" onClick={() => setOpen(false)}>
        {t("cancel")}
      </Button>
    </section>
  ) : (
    <Button type="button" size="lg" className="h-12 self-start" onClick={() => setOpen(true)}>
      {t("newItem")}
    </Button>
  )
}

export function AddStarterList({ missing }: { missing: number }) {
  const t = useTranslations("admin.compliance")
  const { pending, error, run } = useAction()
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="lg" className="h-12 self-start" disabled={pending} onClick={() => run(addStarterItemsAction)}>
        {t("addStarter", { count: missing })}
      </Button>
      <p className="text-sm text-muted-foreground">{t("starterHint")}</p>
      <ErrorLine text={error} />
    </div>
  )
}
