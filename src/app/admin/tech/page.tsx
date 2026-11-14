import { getTranslations } from "next-intl/server"
import { CheckCircle2, CircleAlert, CircleDashed, ExternalLink } from "lucide-react"
import { techMonitor } from "@/server/admin-overview"
import { cn } from "@/lib/utils"
import { Panel } from "../admin-ui"

const BACKUPS_URL = "https://github.com/amalvanathaiyan/MerryFarms/actions/workflows/backup.yml"

const mb = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`)

const LEVEL_BAR = { ok: "bg-primary", watch: "bg-sun", near: "bg-destructive" } as const

/**
 * Admin · Tech monitor: is everything the app needs in place and healthy? Service keys (set or not; never their
 * values), the version running, database and file storage against the free limits, rows per table, and where the
 * backups are. The job engine has its own page (Automation).
 */
export default async function AdminTechPage() {
  const t = await getTranslations("admin.tech")
  const m = await techMonitor()

  const usage = (label: string, u: { bytes: number; limit: number; pct: number; level: keyof typeof LEVEL_BAR } | null, extra?: string) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="text-sm tabular-nums">{u ? t("useOf", { used: mb(u.bytes), limit: mb(u.limit), pct: u.pct }) : t("unknown")}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={u ? t("useOf", { used: mb(u.bytes), limit: mb(u.limit), pct: u.pct }) : t("unknown")}>
        {u && <div className={cn("h-full rounded-full", LEVEL_BAR[u.level])} style={{ width: `${Math.max(1, u.pct)}%` }} />}
      </div>
      {u && u.level !== "ok" && <p className={cn("text-sm font-semibold", u.level === "near" ? "text-destructive" : "")}>{t(`level_${u.level}`)}</p>}
      {extra && <p className="text-sm text-muted-foreground">{extra}</p>}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("versionTitle")}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t("host")}</dt>
            <dd className="font-semibold">
              {m.version.host}
              {m.version.region && <span className="font-normal text-muted-foreground"> · {m.version.region}</span>}
            </dd>
            <dt className="text-muted-foreground">{t("environment")}</dt>
            <dd className="font-semibold">{m.version.environment}</dd>
            <dt className="text-muted-foreground">{t("commit")}</dt>
            <dd className="min-w-0">
              {m.version.commit ? (
                <>
                  <span className="font-mono font-semibold">{m.version.commit}</span>
                  {m.version.branch && <span className="text-muted-foreground"> · {m.version.branch}</span>}
                  {m.version.message && <span className="block break-words text-muted-foreground">{m.version.message}</span>}
                </>
              ) : (
                <span className="text-muted-foreground">{t("commitLocal")}</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Node</dt>
            <dd className="font-mono">{m.version.node}</dd>
          </dl>
        </Panel>

        <Panel title={t("useTitle")} hint={t("useHint")}>
          {usage(t("database"), m.database)}
          {usage(t("storage"), m.storage, m.storage ? t("files", { count: m.storage.files }) : t("storageUnknown"))}
        </Panel>
      </div>

      <Panel title={t("servicesTitle")} hint={t("servicesHint")}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {m.services.map((s) => {
            const Icon = s.state === "ready" ? CheckCircle2 : s.state === "partly" || s.required ? CircleAlert : CircleDashed
            return (
              <li key={s.key} className={cn("flex flex-col gap-1 rounded-xl border p-3", s.state !== "ready" && s.required && "border-destructive/40 bg-destructive/5")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon className={cn("size-5 shrink-0", s.state === "ready" ? "text-primary" : s.required ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                    {t(`service_${s.key}`)}
                  </span>
                  <span className="shrink-0 text-xs font-semibold">
                    {t(`state_${s.state}`)}
                    {!s.required && s.state === "missing" && ` · ${t("optional")}`}
                  </span>
                </div>
                {s.state !== "ready" && (
                  <ul className="flex flex-wrap gap-1.5 text-xs">
                    {s.keys.map((k) => (
                      <li key={k.name} className={cn("rounded-md px-1.5 py-0.5 font-mono", k.set ? "bg-accent text-primary" : "bg-muted text-muted-foreground line-through")}>
                        {k.name}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("providerOtp")}</dt>
          <dd className="font-semibold">{m.providers.otp ? t(`otp_${m.providers.otp}`) : t("providerNone")}</dd>
          <dt className="text-muted-foreground">{t("providerWhatsapp")}</dt>
          <dd className="font-semibold">{m.providers.whatsapp ? t("whatsappCloud") : t("providerNone")}</dd>
          <dt className="text-muted-foreground">{t("providerPush")}</dt>
          <dd className="font-semibold">{m.providers.push ? t("pushWeb") : t("providerNone")}</dd>
        </dl>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("backupsTitle")} hint={t("backupsHint")}>
          <a href={BACKUPS_URL} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 self-start rounded-xl border-2 px-4 font-semibold hover:bg-accent">
            <ExternalLink className="size-4" aria-hidden /> {t("backupsOpen")}
          </a>
        </Panel>

        <Panel title={t("tablesTitle")} hint={t("tablesHint")}>
          {m.tables.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("unknown")}</p>
          ) : (
            <details>
              <summary className="cursor-pointer font-semibold text-primary">{t("tablesShow", { count: m.tables.length })}</summary>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2">
                {m.tables.map((r) => (
                  <li key={r.name} className="flex justify-between gap-3 border-b border-dashed py-1">
                    <span className="min-w-0 truncate font-mono">{r.name}</span>
                    <span className="tabular-nums">{r.rows.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>
      </div>
    </div>
  )
}
