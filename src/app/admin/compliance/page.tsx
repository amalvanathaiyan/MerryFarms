import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { ChevronRight, ListChecks, TriangleAlert } from "lucide-react"
import { complianceConfig, listCases, listItems, repeatFarms } from "@/server/compliance"
import { pick } from "@/lib/i18n-helpers"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FarmMark } from "../farm-bits"
import { CaseDecisionForm, ScreeningSettings } from "./compliance-forms"

const ACTION_STYLE: Record<string, string> = { block: "bg-destructive/15 text-destructive", hold: "bg-yolk text-yolk-foreground", licence: "bg-accent text-accent-foreground" }

/**
 * Admin · Compliance, read top to bottom: whether screening is on (and its settings, folded); farms with repeated
 * cases; then the inbox: what each farm listed, the word that matched and the list entry's reason, and the decision
 * buttons. The restricted items list has its own page, one tap away.
 */
export default async function CompliancePage({ searchParams }: { searchParams: Promise<{ show?: string; farm?: string }> }) {
  const sp = await searchParams
  const show = sp.show === "decided" ? "decided" : "open"
  const t = await getTranslations("admin.compliance")
  const locale = await getLocale()
  const [config, cases, items, repeat] = await Promise.all([complianceConfig(), listCases(show, sp.farm), listItems(), repeatFarms()])
  const openCount = show === "open" ? cases.length : (await listCases("open", sp.farm)).length
  const when = new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
  const onlyFarm = sp.farm ? cases[0]?.farm : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("title")}</h1>
          <p className="text-muted-foreground">{t("hint")}</p>
        </div>
        <Button asChild variant="outline" size="lg" className="h-12">
          <Link href="/admin/compliance/items">
            <ListChecks aria-hidden /> {t("listLink", { count: items.filter((i) => i.active).length })}
          </Link>
        </Button>
      </div>

      <details className="group rounded-2xl border bg-card">
        <summary className={cn("flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-semibold", config.on ? "bg-accent" : "bg-yolk text-yolk-foreground")}>
          {config.on ? t("isOn") : t("isOff")}
          <span className="text-sm font-normal underline">{t("change")}</span>
        </summary>
        <div className="p-4">
          <ScreeningSettings initial={config} />
        </div>
      </details>

      {repeat.map((f) => (
        <Link key={f.id} href={`/admin/farms/${f.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-destructive/10 px-4 py-3 font-semibold text-destructive hover:underline">
          <span className="flex items-center gap-2">
            <TriangleAlert className="size-5 shrink-0" aria-hidden /> {t("repeatFarm", { farm: pick(locale, f.nameTa, f.nameEn), count: f.count })}
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      ))}

      <nav aria-label={t("title")} className="flex flex-wrap items-center gap-2">
        {(["open", "decided"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/compliance${s === "decided" ? "?show=decided" : ""}${sp.farm ? `${s === "decided" ? "&" : "?"}farm=${sp.farm}` : ""}`}
            aria-current={s === show ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold", s === show ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}
          >
            {t(`show_${s}`)}
            {s === "open" && <span className="tabular-nums">{openCount}</span>}
          </Link>
        ))}
        {sp.farm && (
          <Link href={show === "decided" ? "/admin/compliance?show=decided" : "/admin/compliance"} className="flex min-h-11 items-center px-2 text-sm font-semibold underline">
            {onlyFarm ? t("onlyFarm", { farm: pick(locale, onlyFarm.nameTa, onlyFarm.nameEn) }) : ""} {t("allFarms")}
          </Link>
        )}
      </nav>

      {cases.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">{show === "open" ? t("noneOpen") : t("noneDecided")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                {c.kind === "product" && c.product?.imageUrl && c.farm ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the farm's own product photo, from our route
                  <img src={`/img/p/${c.subjectId}?farm=${c.farm.slug}&${c.product.imageUrl.split("?")[1] ?? ""}`} alt="" className="size-20 shrink-0 rounded-xl border bg-muted object-cover" />
                ) : (
                  <FarmMark logoUrl={null} initials={c.kind === "product" ? "P" : "C"} className="size-20" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg leading-snug font-bold">{c.subjectName}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", ACTION_STYLE[c.action] ?? "bg-muted")}>{t(`action_${c.action}`)}</span>
                  </div>
                  <span className="text-sm">
                    {t(`kind_${c.kind}`)} ·{" "}
                    {c.farm ? (
                      <Link href={`/admin/farms/${c.farm.id}`} className="font-semibold underline">
                        {pick(locale, c.farm.nameTa, c.farm.nameEn)}
                      </Link>
                    ) : (
                      "—"
                    )}
                    {c.action === "licence" && c.farm && ` · ${c.farm.fssaiNo ? t("hasLicence") : t("noLicence")}`}
                  </span>
                  <span className="text-sm">
                    {t("matched")} <mark className="rounded bg-yolk px-1 font-semibold text-yolk-foreground">{c.matched}</mark>
                    {c.item && ` · ${pick(locale, c.item.labelTa, c.item.labelEn)}`}
                  </span>
                  {c.product && (c.product.noteTa || c.product.noteEn) && <span className="text-sm text-muted-foreground">{pick(locale, c.product.noteTa, c.product.noteEn)}</span>}
                  {c.item && <span className="text-sm text-muted-foreground">{pick(locale, c.item.reasonTa, c.item.reasonEn)}</span>}
                  <span className="text-xs text-muted-foreground tabular-nums">{when.format(c.createdAt)}</span>
                </div>
              </div>
              {c.status !== "open" && (
                <p className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <span className="font-semibold">{t(`state_${c.status}`)}</span>
                  {c.decidedBy && ` · ${c.decidedBy}`}
                  {c.decidedAt && ` · ${when.format(c.decidedAt)}`}
                  {c.note && <span className="block">{c.note}</span>}
                </p>
              )}
              {(c.status === "open" || (c.status === "kept_hidden" && c.kind === "product")) && <CaseDecisionForm id={c.id} kind={c.kind} status={c.status} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
