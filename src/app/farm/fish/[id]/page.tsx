import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { AlertTriangle } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { dayLabel } from "@/lib/i18n-helpers"
import { daysBetween, istDate } from "@/domain/ist"
import { formatRupees } from "@/domain/money"
import { isFishSpecies, waterWarnings } from "@/domain/fish"
import { cycleDetail } from "@/server/fish"
import { SectionHeader } from "@/components/farm/section-header"
import { AddSample, AddStocking, CycleClose, RemoveRow } from "@/components/farm/fish-forms"
import { cn } from "@/lib/utils"

const n = (x: number) => x.toLocaleString("en-IN")

/** One pond's cycle: what's in it, what was put in, net samples, the days entered, and closing it. */
export default async function FishCyclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "fishCare")
  const t = await getTranslations("farm.fish")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const d = await cycleDetail(db, id, today)
  if (!d) notFound()
  const { cycle } = d
  const boss = staff.roles.includes("owner")
  const open = !cycle.closedDate
  const kind = (s: string | null) => (s == null ? t("allKinds") : isFishSpecies(s) ? t(`species_${s}`) : s)
  const day = (date: string) => dayLabel(date, locale, labels)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        section="fish"
        back={{ href: "/farm/fish", label: t("ponds") }}
        title={`${d.pond?.name ?? ""} · ${t("cycleN", { n: cycle.number })}`}
        hint={open ? t("runningSince", { date: day(cycle.startDate), days: daysBetween(cycle.startDate, today) + 1 }) : t("closedOn", { from: day(cycle.startDate), to: day(cycle.closedDate!) })}
      />

      <section className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          [t("stocked"), n(d.stocked)],
          [t("dead"), n(d.dead)],
          [t("fishLeft"), n(d.left)],
          [t("survival"), d.survivalPct == null ? "—" : `${d.survivalPct}%`],
          [t("size"), d.average ? t("grams", { g: n(d.average.grams) }) : "—"],
          [t("inPond"), d.weight ? t("kg", { kg: n(d.weight.kg) }) : "—"],
          [t("feedSoFar"), t("kg", { kg: n(d.feedKg) })],
          [t("fcr"), d.weight?.fcr ?? "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-bold tabular-nums">{value}</div>
          </div>
        ))}
      </section>
      {d.weight?.fcr != null && <p className="-mt-2 text-sm text-muted-foreground">{t("fcrHint")}</p>}

      {open && (
        <Link href={`/farm/fish/entry?cycle=${cycle.id}`} className="flex h-14 items-center justify-center rounded-2xl bg-sec-fish text-lg font-bold text-sec-on">
          {d.enteredToday ? t("enteredToday") : t("enterToday")}
        </Link>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("stockings")}</h2>
        <ul className="divide-y">
          {cycle.stockings.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <b>{kind(s.species)}</b> · {n(s.count)}
                {s.sizeGrams ? ` · ${t("grams", { g: n(s.sizeGrams) })}` : ""} · {day(s.date)}
                {s.supplier && <span className="text-muted-foreground"> · {s.supplier}</span>}
              </span>
              <span className="flex items-center gap-2">
                {boss && s.costPaise > 0 && <span className="tabular-nums">{formatRupees(s.costPaise)}</span>}
                {boss && open && cycle.stockings.length > 1 && <RemoveRow id={s.id} what="stocking" />}
              </span>
            </li>
          ))}
        </ul>
        {boss && open && <AddStocking cycleId={cycle.id} today={today} />}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("samples")}</h2>
        {cycle.samples.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSamples")}</p>
        ) : (
          <ul className="divide-y">
            {cycle.samples.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {day(s.date)} · {kind(s.species)} · {t("sampleLine", { count: s.count, kg: n(Math.round(s.totalGrams / 100) / 10) })}
                </span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums">{t("grams", { g: n(Math.round(s.totalGrams / s.count)) })}</b>
                  {boss && <RemoveRow id={s.id} what="sample" />}
                </span>
              </li>
            ))}
          </ul>
        )}
        {open && <AddSample cycleId={cycle.id} today={today} kinds={d.mix.map((m) => m.species)} />}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
        <h2 className="text-lg font-semibold">{t("days")}</h2>
        {cycle.days.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noDays")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {cycle.days.slice(0, 30).map((x) => {
              const w = waterWarnings(x)
              return (
                <li key={x.id}>
                  <Link href={`/farm/fish/entry?cycle=${cycle.id}&date=${x.date}`} className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2", open && "hover:text-primary")}>
                    <span className="font-semibold">{day(x.date)}</span>
                    <span className="flex flex-wrap gap-x-3 text-muted-foreground tabular-nums">
                      {x.feedKg != null && <span>{t("feedLine", { kg: n(x.feedKg) })}</span>}
                      {x.dead > 0 && <span className="text-destructive">{t("deadLine", { count: x.dead })}</span>}
                      {w.length > 0 && (
                        <span className={cn("flex items-center gap-1", w[0].danger ? "text-destructive" : "text-yolk-foreground")}>
                          <AlertTriangle className="size-4" aria-hidden /> {w.map((v) => t(`warn_${v.check}_${v.side}`)).join(" · ")}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {boss && <CycleClose cycleId={cycle.id} closed={!open} today={today} />}
    </div>
  )
}
