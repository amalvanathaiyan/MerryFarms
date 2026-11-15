import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { AlertTriangle, CheckCircle2, PencilLine } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { requireFeature } from "@/lib/require-feature"
import { featuresOf } from "@/lib/features"
import { dayLabel } from "@/lib/i18n-helpers"
import { fishOnMenu, fishTabs } from "@/lib/farm-sections"
import { effectiveRoles } from "@/domain/staff"
import { daysBetween, istDate } from "@/domain/ist"
import { isFishSpecies } from "@/domain/fish"
import { fishBook } from "@/server/fish"
import { SectionHeader } from "@/components/farm/section-header"
import { StartCycle } from "@/components/farm/fish-forms"
import { cn } from "@/lib/utils"

const n = (x: number) => x.toLocaleString("en-IN")

/** Fishery · Ponds: each pond's running cycle (fish left, size, feed, water), starting a new one, and past cycles. */
export default async function FishPage() {
  const { db, tenant, staff } = await requireStaff(["owner", "packing"])
  requireFeature(tenant, "fishCare")
  const t = await getTranslations("farm.fish")
  const tc = await getTranslations("common")
  const locale = await getLocale()
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const today = istDate(new Date())
  const who = { roles: staff.roles, features: featuresOf(tenant) }
  const boss = effectiveRoles(staff.roles).includes("owner")
  const book = await fishBook(db, today)
  const kind = (s: string) => (isFishSpecies(s) ? t(`species_${s}`) : s)

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="fish" tabs={fishTabs(who)} active="ponds" back={fishOnMenu(who) ? undefined : { href: "/farm/more" }} />

      {!book.hasPonds ? (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <p>{t("noPonds")}</p>
          {boss && (
            <Link href="/farm/land" className="self-start font-semibold text-primary underline underline-offset-4">
              {t("addPond")}
            </Link>
          )}
        </section>
      ) : (
        boss && book.freePonds.length > 0 && <StartCycle ponds={book.freePonds} today={today} />
      )}

      {book.open.length === 0 && book.hasPonds && <p className="py-6 text-center text-muted-foreground">{t("noCycles")}</p>}

      <ul className="flex flex-col gap-3">
        {book.open.map((c) => {
          const bad = c.lastWater?.warnings ?? []
          return (
            <li key={c.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
              <Link href={`/farm/fish/${c.id}`} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-lg font-bold">{c.pond}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t("cycleN", { n: c.number })} · {t("dayN", { n: daysBetween(c.startDate, today) + 1 })}
                  </span>
                  <span className="block text-sm text-muted-foreground">{c.mix.map((m) => `${kind(m.species)} ${n(m.count)}`).join(" · ")}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-2xl font-bold tabular-nums">{n(c.left)}</span>
                  <span className="block text-xs text-muted-foreground">{t("fishLeft")}</span>
                </span>
              </Link>
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-xs text-muted-foreground">{t("size")}</dt>
                  <dd className="font-semibold tabular-nums">{c.average ? t("grams", { g: n(c.average.grams) }) : "—"}</dd>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-xs text-muted-foreground">{t("inPond")}</dt>
                  <dd className="font-semibold tabular-nums">{c.weight ? t("kg", { kg: n(c.weight.kg) }) : "—"}</dd>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <dt className="text-xs text-muted-foreground">{t("feedSoFar")}</dt>
                  <dd className="font-semibold tabular-nums">{t("kg", { kg: n(c.feedKg) })}</dd>
                </div>
              </dl>
              {bad.length > 0 && (
                <p className={cn("flex gap-2 rounded-lg px-3 py-2 text-sm", bad[0].danger ? "bg-destructive/10 text-destructive" : "bg-yolk text-yolk-foreground")}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    {bad.map((w) => t(`warn_${w.check}_${w.side}`)).join(" · ")} ({dayLabel(c.lastWater!.date, locale, labels)})
                  </span>
                </p>
              )}
              <Link
                href={`/farm/fish/entry?cycle=${c.id}`}
                className={cn("flex h-12 items-center justify-center gap-2 rounded-xl text-base font-bold", c.enteredToday ? "border-2 bg-card hover:bg-accent" : "bg-sec-fish text-sec-on")}
              >
                {c.enteredToday ? <CheckCircle2 className="size-5" aria-hidden /> : <PencilLine className="size-5" aria-hidden />}
                {c.enteredToday ? t("enteredToday") : t("enterToday")}
              </Link>
            </li>
          )
        })}
      </ul>

      {book.closed.length > 0 && (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-semibold">{t("pastCycles", { count: book.closed.length })}</summary>
          <ul className="mt-2 divide-y">
            {book.closed.map((c) => (
              <li key={c.id}>
                <Link href={`/farm/fish/${c.id}`} className="flex justify-between gap-3 py-2.5 hover:text-primary">
                  <span>
                    {c.pond} · {t("cycleN", { n: c.number })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {dayLabel(c.startDate, locale, labels)} – {dayLabel(c.closedDate!, locale, labels)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
