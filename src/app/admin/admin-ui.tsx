import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { AuditEntry } from "@prisma/client"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"

/** Pieces shared by admin's dashboard, tech monitor and audit log. */

export function Tile({ label, value, sub, tone, href }: { label: string; value: React.ReactNode; sub?: string; tone?: "warn" | "bad" | "good"; href?: string }) {
  const body = (
    <>
      <div className="text-sm">{label}</div>
      <div className="font-display text-3xl leading-tight font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs opacity-80">{sub}</div>}
    </>
  )
  const cls = cn(
    "flex flex-col rounded-2xl p-4",
    tone === "warn" ? "bg-yolk text-yolk-foreground" : tone === "bad" ? "bg-destructive/10 text-destructive" : tone === "good" ? "bg-accent" : "border bg-card",
    href && "hover:border-primary"
  )
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Panel({ title, hint, action, children, className }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">{title}</h2>
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export async function whenFormat() {
  const locale = await getLocale()
  return new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
}

const show = (v: unknown) => {
  const text = JSON.stringify(v, null, 1)
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text
}

/**
 * Audit log lines: when, who (and whether through support), which farm, what was done, and the values before and
 * after, folded.
 */
export async function AuditRows({ rows, farms, compact = false }: { rows: AuditEntry[]; farms: { id: string; nameTa: string; nameEn: string }[]; compact?: boolean }) {
  const t = await getTranslations("admin.audit")
  const locale = await getLocale()
  const when = await whenFormat()
  const farmName = (id: string | null) => {
    if (!id) return t("platform")
    const f = farms.find((x) => x.id === id)
    return f ? pick(locale, f.nameTa, f.nameEn) : t("farmGone")
  }
  const label = (action: string) => {
    const k = `a_${action.replace(/\./g, "_")}`
    return t.has(k) ? t(k) : action
  }
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("none")}</p>
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const hasValues = r.before != null || r.after != null
        return (
          <li key={r.id} className="flex flex-col gap-0.5 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold">{label(r.action)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{when.format(r.createdAt)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{farmName(r.tenantId)}</span>
              <span aria-hidden>·</span>
              <span>
                {r.actorName ?? t(`kind_${r.actorKind}`)}
                {r.actorName && <span className="opacity-80"> ({t(`kind_${r.actorKind}`)})</span>}
              </span>
              {r.viaSupport && <span className="rounded-full bg-yolk px-2 text-xs font-semibold text-yolk-foreground">{t("viaSupport")}</span>}
              {r.subject && !compact && <span className="font-mono text-xs break-all opacity-70">{r.subject}</span>}
            </div>
            {hasValues && !compact && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-primary">{t("values")}</summary>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {r.before != null && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">{t("before")}</div>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap break-all">{show(r.before)}</pre>
                    </div>
                  )}
                  {r.after != null && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground">{t("after")}</div>
                      <pre className="overflow-x-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap break-all">{show(r.after)}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </li>
        )
      })}
    </ul>
  )
}
