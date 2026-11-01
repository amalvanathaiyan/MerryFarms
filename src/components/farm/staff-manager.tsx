"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { Copy, KeyRound, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addStaffAction, resetStaffPasswordAction, setStaffActiveAction, updateStaffAction } from "@/app/actions/staff"
import { ROLES, type Role } from "@/domain/staff"
import { cn } from "@/lib/utils"

export type StaffRow = { id: string; name: string; staffCode: string | null; email: string | null; phone: string | null; roles: Role[]; isActive: boolean; isMe: boolean; demo: boolean }
type Draft = { id?: string; name: string; email: string; phone: string; roles: Role[] }

/** The owner adds staff, sets what they can do, resets passwords and removes access. */
export function StaffManager({ rows, demo }: { rows: StaffRow[]; demo: boolean }) {
  const t = useTranslations("farm.staff")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shown, setShown] = useState<{ name: string; signInWith: string; password: string } | null>(null)
  const [pending, start] = useTransition()

  const fail = (code: string) => setError(te.has(code) ? te(code) : te("generic"))

  const roleChips = (selected: Role[], onToggle?: (r: Role) => void) => (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => {
        const on = selected.includes(r)
        if (!onToggle && !on) return null
        return onToggle ? (
          <button key={r} type="button" aria-pressed={on} onClick={() => onToggle(r)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-primary bg-accent" : "bg-card")}>
            {t(`role_${r}`)}
          </button>
        ) : (
          <span key={r} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold">
            {t(`role_${r}`)}
          </span>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {shown && (
        <div role="status" className="flex flex-col gap-2 rounded-2xl border-2 border-primary bg-card p-4">
          <p className="font-semibold">{t("passwordFor", { name: shown.name })}</p>
          <p className="font-semibold tracking-wide">{shown.signInWith}</p>
          <p className="flex items-center justify-between gap-2 rounded-lg bg-accent px-3 py-2 font-mono text-lg tracking-wide">
            {shown.password}
            <button type="button" aria-label={t("copy")} onClick={() => navigator.clipboard?.writeText(`${shown.signInWith}\n${shown.password}`)}>
              <Copy className="size-4" />
            </button>
          </p>
          <p className="text-sm">{t("passwordHint")}</p>
          <Button variant="outline" onClick={() => setShown(null)}>
            {t("done")}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {draft ? (
        <form
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setError(null)
              const payload = { name: draft.name, phone: draft.phone || undefined, roles: draft.roles }
              const r = draft.id ? await updateStaffAction({ ...payload, id: draft.id }) : await addStaffAction({ ...payload, email: draft.email })
              if (!r.ok) return fail(r.error)
              if (!draft.id && r.password) setShown({ name: draft.name, signInWith: r.staffCode ?? draft.email, password: r.password })
              setDraft(null)
            })
          }}
        >
          <h2 className="text-lg font-semibold">{draft.id ? t("editTitle") : t("addTitle")}</h2>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("name")}
            <Input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="font-normal" />
          </label>
          {!draft.id && (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("email")}
              <Input required={draft.roles.includes("owner")} type="email" autoComplete="off" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="font-normal" />
              <span className="font-normal text-muted-foreground">{demo ? t("emailHintDemo") : t("emailHint")}</span>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            {t("phone")}
            <Input type="tel" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="font-normal" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("canDo")}</span>
            {roleChips(draft.roles, (r) => setDraft({ ...draft, roles: draft.roles.includes(r) ? draft.roles.filter((x) => x !== r) : [...draft.roles, r] }))}
            <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
              {draft.roles.map((r) => (
                <li key={r}>{t(`roleHint_${r}`)}</li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={pending || draft.roles.length === 0}>
              {draft.id ? tc("save") : t("add")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <Button size="lg" onClick={() => (setError(null), setDraft({ name: "", email: "", phone: "", roles: ["order_desk"] }))}>
          <UserPlus /> {t("addStaff")}
        </Button>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((s) => (
          <li key={s.id} className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-4", !s.isActive && "opacity-60")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">
                  {s.name} {s.isMe && <span className="text-sm font-normal text-muted-foreground">({t("you")})</span>}
                </div>
                <div className="truncate text-sm text-muted-foreground">{[s.staffCode, s.email, s.phone].filter(Boolean).join(" · ")}</div>
              </div>
              {!s.isActive && <span className="shrink-0 rounded-full bg-muted px-2 text-xs font-semibold">{t("noAccess")}</span>}
            </div>
            {roleChips(s.roles)}
            <div className="flex flex-wrap gap-2">
              {s.isActive && (
                <Button variant="outline" size="sm" onClick={() => (setError(null), setDraft({ id: s.id, name: s.name, email: s.email ?? "", phone: s.phone ?? "", roles: s.roles }))}>
                  {tc("edit")}
                </Button>
              )}
              {s.isActive && !s.demo && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setError(null)
                      const r = await resetStaffPasswordAction(s.id)
                      if (!r.ok) return fail(r.error)
                      if (r.password) setShown({ name: s.name, signInWith: s.staffCode ?? s.email ?? "", password: r.password })
                    })
                  }
                >
                  <KeyRound /> {t("resetPassword")}
                </Button>
              )}
              {!s.isMe && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={s.isActive ? "text-destructive" : undefined}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      setError(null)
                      const r = await setStaffActiveAction(s.id, !s.isActive)
                      if (!r.ok) fail(r.error)
                    })
                  }
                >
                  {s.isActive ? t("removeAccess") : t("giveAccess")}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
