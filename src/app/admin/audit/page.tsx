import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { pick } from "@/lib/i18n-helpers"
import { AUDIT_GROUPS } from "@/domain/admin-overview"
import { auditLog } from "@/server/admin-overview"
import { AuditRows } from "../admin-ui"

/**
 * Admin · Audit log: every change made by Farm For You admin, support, farm staff (settings, switches, poultry
 * entries) and the app, newest first. Filter by farm and by kind of change; who, when, and the values before and after.
 */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ farm?: string; group?: string; before?: string }> }) {
  const sp = await searchParams
  const t = await getTranslations("admin.audit")
  const locale = await getLocale()
  const farms = await prisma.tenant.findMany({ select: { id: true, nameTa: true, nameEn: true }, orderBy: { createdAt: "asc" } })
  const farm = sp.farm === "platform" || farms.some((f) => f.id === sp.farm) ? sp.farm : undefined
  const group = (AUDIT_GROUPS as readonly string[]).includes(sp.group ?? "") ? sp.group : undefined
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before) : undefined
  const { rows, more } = await auditLog({ farm, group, before })
  const q = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ farm, group, ...extra }).filter((e): e is [string, string] => !!e[1]))
    const s = p.toString()
    return `/admin/audit${s ? `?${s}` : ""}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("hint")}</p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">
          {t("filterFarm")}
          <select name="farm" defaultValue={farm ?? ""} className="h-11 rounded-xl border-2 border-input bg-background px-2 font-normal">
            <option value="">{t("allFarms")}</option>
            <option value="platform">{t("platform")}</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {pick(locale, f.nameTa, f.nameEn)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">
          {t("filterKind")}
          <select name="group" defaultValue={group ?? ""} className="h-11 rounded-xl border-2 border-input bg-background px-2 font-normal">
            <option value="">{t("allKinds")}</option>
            {AUDIT_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`group_${g}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
          {t("show")}
        </button>
        {(farm || group) && (
          <Link href="/admin/audit" className="flex h-11 items-center px-2 text-sm font-semibold text-primary underline underline-offset-4">
            {t("clear")}
          </Link>
        )}
      </form>

      {before && (
        <Link href={q({})} className="self-start text-sm font-semibold text-primary underline underline-offset-4">
          ← {t("newest")}
        </Link>
      )}

      <section className="rounded-2xl border bg-card px-4 py-1">
        <AuditRows rows={rows} farms={farms} />
      </section>

      {more && (
        <Link href={q({ before: rows.at(-1)!.createdAt.toISOString() })} className="self-center rounded-xl border-2 bg-card px-4 py-2 font-semibold hover:bg-accent">
          {t("older")}
        </Link>
      )}
    </div>
  )
}
