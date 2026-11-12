"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Check, Send, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { requestAddOnAction, requestPlanChangeAction, withdrawRequestAction } from "@/app/actions/platform-plans"
import { useCheer } from "@/components/cheer"
import type { ModuleKey } from "@/domain/modules"

type ModuleRow = { key: ModuleKey; has: boolean; available: boolean; requestable: boolean; price: string; trialDays: number }
type PlanRow = { id: string; name: string; description: string | null; price: string; modules: string[] }
type RequestRow = { id: string; kind: string; moduleKey: string | null; planName: string | null; status: string; reply: string | null; when: string }

/**
 * The farm's modules (has it, can ask for it, coming soon), other plans it can move to, and its requests. Asking
 * sends a request to Farm For You, who approve it; nothing changes until then.
 */
export function PlanModules({ modules, plans, requests }: { modules: ModuleRow[]; plans: PlanRow[]; requests: RequestRow[] }) {
  const t = useTranslations("farm.planModules")
  const tm = useTranslations("modules")
  const te = useTranslations("errors")
  const cheer = useCheer()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const waiting = (r: (x: RequestRow) => boolean) => requests.some((x) => x.status === "pending" && r(x))

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error && te.has(r.error) ? te(r.error) : te("generic"))
      cheer("settings")
      router.refresh()
    })

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="text-lg font-bold">{t("modulesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("modulesHint")}</p>
        </div>
        <ul className="flex flex-col divide-y">
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="font-medium">{tm("core")}</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-primary">
              <Check className="size-4" aria-hidden /> {t("included")}
            </span>
          </li>
          {modules.map((m) => (
            <li key={m.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="font-medium">{tm(m.key)}</span>
                {!m.has && m.available && <span className="block text-sm text-muted-foreground">{t("addOnPrice", { price: m.price, days: m.trialDays })}</span>}
              </span>
              {m.has ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  <Check className="size-4" aria-hidden /> {t("included")}
                </span>
              ) : !m.available ? (
                <span className="rounded-full bg-yolk px-2.5 py-0.5 text-sm text-yolk-foreground">{t("comingSoon")}</span>
              ) : waiting((x) => x.kind === "add_on" && x.moduleKey === m.key) ? (
                <span className="text-sm font-semibold">{t("asked")}</span>
              ) : m.requestable ? (
                <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => requestAddOnAction({ moduleKey: m.key, note: null }))}>
                  <Send /> {t("askForIt")}
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">{t("askUs")}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {plans.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-bold">{t("otherPlans")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((p) => (
              <article key={p.id} className="flex flex-col gap-2 rounded-2xl border p-4">
                <h3 className="font-display text-lg font-bold">{p.name}</h3>
                <p className="font-semibold">{p.price}</p>
                {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                <p className="text-sm">{[tm("core"), ...p.modules.map((m) => tm(m as ModuleKey))].join(" · ")}</p>
                {waiting((x) => x.kind === "plan_change" && x.planName === p.name) ? (
                  <span className="text-sm font-semibold">{t("asked")}</span>
                ) : (
                  <Button type="button" variant="outline" className="self-start" disabled={pending || waiting((x) => x.kind === "plan_change")} onClick={() => run(() => requestPlanChangeAction({ planId: p.id, note: null }))}>
                    <Send /> {t("askToMove")}
                  </Button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {requests.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <h2 className="text-lg font-bold">{t("yourRequests")}</h2>
          <ul className="flex flex-col divide-y">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.kind === "add_on" && r.moduleKey ? tm(r.moduleKey as ModuleKey) : (r.planName ?? t("planChange"))}</span>
                  <span className="text-sm">
                    {t(`req_${r.status}`)} · {r.when}
                  </span>
                </span>
                {r.reply && <span className="rounded-xl bg-muted p-2 text-sm">{r.reply}</span>}
                {r.status === "pending" && (
                  <Button type="button" variant="ghost" size="sm" className="self-start" disabled={pending} onClick={() => run(() => withdrawRequestAction(r.id))}>
                    <Undo2 /> {t("withdraw")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
