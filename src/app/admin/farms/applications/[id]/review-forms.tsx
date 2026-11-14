"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, MessageCircle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { moveApplicationAction, saveReviewAction } from "@/app/actions/applications"
import { CHECKS, NEEDED_CHECKS, needsReply, type ApplicationState, type CheckKey } from "@/domain/applications"
import { cn } from "@/lib/utils"

const area = "rounded-xl border bg-background px-3 py-2 text-base"
const box = "flex flex-col gap-3 rounded-2xl border bg-card p-4"

/** The reviewer's checklist (phone and location needed before approving) and the team's own notes. */
export function ReviewChecklist({ id, checklist, notes, locked }: { id: string; checklist: Partial<Record<CheckKey, boolean>>; notes: string; locked: boolean }) {
  const t = useTranslations("admin.join")
  const te = useTranslations("errors")
  const router = useRouter()
  const [done, setDone] = useState(checklist)
  const [text, setText] = useState(notes)
  const [state, setState] = useState<"idle" | "saved" | string>("idle")
  const [pending, start] = useTransition()
  const save = () =>
    start(async () => {
      const r = await saveReviewAction({ id, checklist: done, notes: text })
      if (!r.ok) return setState(te.has(r.error) ? te(r.error) : te("generic"))
      setState("saved")
      router.refresh()
    })
  return (
    <section className={box}>
      <div>
        <h2 className="text-lg font-bold">{t("checkTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("checkHint")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {CHECKS.map((k) => {
          const on = !!done[k]
          return (
            <li key={k}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={on}
                onClick={() => {
                  setDone((x) => ({ ...x, [k]: !on }))
                  setState("idle")
                }}
                className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left", on ? "border-primary bg-accent" : "bg-background hover:border-primary", locked && "opacity-70")}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2", on ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{on && <Check className="size-5" aria-hidden />}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {t(`check_${k}`)}
                    {NEEDED_CHECKS.includes(k) && <span className="font-normal text-muted-foreground"> · {t("needed")}</span>}
                  </span>
                  <span className="block text-sm text-muted-foreground">{t(`check_${k}_hint`)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t("notes")}</span>
        <textarea
          rows={3}
          maxLength={2000}
          disabled={locked}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setState("idle")
          }}
          className={area}
        />
        <span className="text-sm text-muted-foreground">{t("notesHint")}</span>
      </label>
      {!locked && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" className="h-12" onClick={save} disabled={pending}>
            {t("saveCheck")}
          </Button>
          {state === "saved" && (
            <span role="status" className="font-medium text-primary">
              {t("saved")}
            </span>
          )}
          {state !== "idle" && state !== "saved" && (
            <span role="alert" className="font-medium text-destructive">
              {state}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * What to do with it. Adding the farm is the main step (it opens New farm filled in, and approves this); the others
 * are smaller buttons. Asking for details or turning down needs words for the farm, which then go by WhatsApp.
 */
export function ApplicationDecision(props: { id: string; status: string; next: ApplicationState[]; missing: CheckKey[]; reply: string | null; phone: string; number: string }) {
  const { id, status, next, missing, reply, phone, number } = props
  const t = useTranslations("admin.join")
  const te = useTranslations("errors")
  const router = useRouter()
  const [moving, setMoving] = useState<ApplicationState | null>(null)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const open = status !== "approved" && status !== "rejected"
  // "Under review" is reached by saving the checklist, so it isn't offered as a button while new
  const moves = next.filter((s) => !(s === "reviewing" && status === "applied"))

  const confirm = (to: ApplicationState) =>
    start(async () => {
      setError(null)
      const r = await moveApplicationAction({ id, to, reply: needsReply(to) ? text : null })
      if (!r.ok) return setError(te.has(r.error) ? te(r.error) : te("generic"))
      setMoving(null)
      setText("")
      router.refresh()
    })

  return (
    <section className={box}>
      <h2 className="text-lg font-bold">{t("decideTitle")}</h2>

      {reply && (status === "needs_info" || status === "rejected") && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
          <p className="text-sm font-semibold">{status === "needs_info" ? t("askedFor") : t("toldWhy")}</p>
          <p className="whitespace-pre-line">{reply}</p>
          <Button asChild variant="outline" className="h-11 self-start">
            <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`Farm For You · ${number}\n${reply}`)}`} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden /> {t("sendWhatsApp")}
            </a>
          </Button>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-1.5">
          {missing.length === 0 ? (
            <Button asChild size="lg" className="h-14 self-start bg-sun text-lg text-sun-foreground hover:bg-[hsl(45_100%_44%)]">
              <Link href={`/admin/farms/new?from=${id}`}>
                <Plus aria-hidden /> {t("addFarm")}
              </Link>
            </Button>
          ) : (
            <p className="rounded-xl bg-yolk px-3 py-2 font-medium text-yolk-foreground">{t("checkFirst", { checks: missing.map((k) => t(`check_${k}`)).join(", ") })}</p>
          )}
          <p className="text-sm text-muted-foreground">{t("addFarmHint")}</p>
        </div>
      )}

      {moving ? (
        <div className="flex flex-col gap-2 rounded-xl border-2 border-primary p-3">
          <p className="font-semibold">{t(`move_${moving}_sure`)}</p>
          {needsReply(moving) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{moving === "needs_info" ? t("whatNeeded") : t("why")}</span>
              <textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className={area} autoFocus />
              <span className="text-sm text-muted-foreground">{t("replyHint")}</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={moving === "rejected" ? "destructive" : "default"} className="h-11" disabled={pending || (needsReply(moving) && !text.trim())} onClick={() => confirm(moving)}>
              {t(`move_${moving}`)}
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setMoving(null)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        moves.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {moves.map((s) => (
              <Button key={s} type="button" variant="outline" className={cn("h-11", s === "rejected" && "text-destructive hover:text-destructive")} onClick={() => setMoving(s)}>
                {t(`move_${s}`)}
              </Button>
            ))}
          </div>
        )
      )}
      {error && (
        <p role="alert" className="font-medium text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
