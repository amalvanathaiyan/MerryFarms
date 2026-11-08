import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { requireStaff } from "@/lib/auth"
import type { TenantDb } from "@/lib/tenant-db"
import { dayLabel, pick } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import { istDate, istInstant } from "@/domain/ist"
import { cn } from "@/lib/utils"
import { allBalances } from "@/server/billing"
import { featuresOf } from "@/lib/features"
import { generatePlanOrders } from "@/server/plans"
import { EnablePush } from "@/components/push/enable-push"
import { ChevronRight } from "lucide-react"
import { AutoRefresh } from "@/components/auto-refresh"
import { SectionHeader } from "@/components/farm/section-header"
import { SectionIcon } from "@/components/farm/section-icon"
import { SECTION_LOOK, type SectionKey } from "@/lib/farm-sections"
import { batchStatus } from "@/domain/batches"
import { asDay, asInfo, asLoss, loadBatches } from "@/server/batches"
import { InstallApp } from "@/components/install-app"

/**
 * True when a batch on the farm has no entry for today (with poultry care on); otherwise, or with no batches,
 * when nothing was entered as made.
 */
async function recordMissing(db: TenantDb, today: string, poultry: boolean) {
  const onFarm = poultry ? await db.batch.findMany({ where: { startDate: { lte: today }, OR: [{ closedDate: null }, { closedDate: { gte: today } }] }, select: { id: true } }) : []
  if (onFarm.length === 0) return !(await db.productionEntry.findFirst({ where: { date: today }, select: { id: true } }))
  const entered = await db.batchDay.count({ where: { date: today, batchId: { in: onFarm.map((b) => b.id) } } })
  return entered < onFarm.length
}

/** Birds alive today across the batches on the farm; null when there are none. */
async function birdsOnFarm(tenantId: string, today: string) {
  const { batches, days, losses } = await loadBatches(tenantId)
  const live = batches.filter((b) => b.startDate <= today && (!b.closedDate || b.closedDate >= today))
  if (!live.length) return null
  const d = days.map(asDay)
  const l = losses.map(asLoss)
  return live.reduce((a, b) => a + batchStatus(asInfo(b), d, l, today).alive, 0)
}

export default async function TodayPage() {
  const { db, tenant, staff } = await requireStaff()
  const locale = await getLocale()
  const t = await getTranslations("farm.today")
  const tc = await getTranslations("common")
  const tu = await getTranslations("farm.units")
  const tv = await getTranslations("farm.vaccines")
  const te = await getTranslations("errors")
  const labels = { today: tc("today"), tomorrow: tc("tomorrow") }
  const unitName = (u: string) => (tu.has(u) ? tu(u) : u)
  const today = istDate(new Date())
  const features = featuresOf(tenant)
  // Create today's and tomorrow's plan orders (idempotent), before counting anything.
  const planRun = features.subscriptions ? await generatePlanOrders(tenant) : null
  // Owner and packing staff are reminded to enter the day: each batch on the farm, or else what was made.
  const canRecord = features.farmRecords && staff.roles.some((r) => r === "owner" || r === "packing")
  const needsRecord = canRecord && (await recordMissing(db, today, features.poultryCare))
  // Vaccine doses due today or late, for batches still on the farm.
  const vaccinesDue =
    canRecord && features.poultryCare
      ? await db.batchVaccination.findMany({
          where: { givenDate: null, dueDate: { lte: today }, batch: { startDate: { lte: today }, OR: [{ closedDate: null }, { closedDate: { gte: today } }] } },
          include: { batch: { select: { id: true, name: true, number: true } } },
          orderBy: { dueDate: "asc" },
        })
      : []
  // Birds on the farm now, across every batch (poultry care, for owner and packing).
  const birdsNow = canRecord && features.poultryCare ? await birdsOnFarm(tenant.id, today) : null
  const unreadMessages = features.messages ? await db.message.count({ where: { sender: "customer", seenAt: null } }) : 0
  const activePlans = features.subscriptions ? await db.subscription.count({ where: { status: "active" } }) : 0

  const [toConfirm, open, todays, balances, toPack, lowStock] = await Promise.all([
    db.order.count({ where: { status: "to_confirm" } }),
    db.order.count({ where: { status: { in: ["to_confirm", "confirmed", "packed", "out_for_delivery"] } } }),
    db.order.aggregate({
      where: { status: { not: "cancelled" }, createdAt: { gte: istInstant(today, "00:00") } },
      _sum: { totalPaise: true },
    }),
    allBalances(tenant.id),
    db.order.findMany({
      where: { status: { in: ["to_confirm", "confirmed"] } },
      include: { items: { include: { product: true } }, address: true, slot: true },
      orderBy: [{ slotDate: "asc" }, { slotLabel: "asc" }],
    }),
    db.product.findMany({ where: { isActive: true, deletedAt: null, stockQty: { lte: 5 } }, orderBy: { stockQty: "asc" } }),
  ])

  // Packing list: total quantity per product across orders still to pack.
  const packing = new Map<string, { name: string; pack: string; unit: string; qty: number }>()
  for (const o of toPack) {
    for (const i of o.items) {
      const row = packing.get(i.productId) ?? {
        name: pick(locale, i.product.nameTa, i.product.nameEn),
        pack: pick(locale, i.product.packTa, i.product.packEn),
        unit: i.product.stockUnit,
        qty: 0,
      }
      row.qty += i.qty
      packing.set(i.productId, row)
    }
  }

  // Delivery runs: orders grouped by date and slot, with the streets to visit.
  const runs = new Map<string, { label: string; stops: string[] }>()
  for (const o of toPack) {
    const key = `${o.slotDate}|${o.slotLabel}`
    const run = runs.get(key) ?? { label: `${dayLabel(o.slotDate, locale, { today: tc("today"), tomorrow: tc("tomorrow") })} · ${o.slotLabel}`, stops: [] }
    run.stops.push(o.address?.landmark || o.address?.line.split(",").pop()?.trim() || "—")
    runs.set(key, run)
  }

  type Tile = { label: string; value: string; href?: string; section: SectionKey }
  const tiles = ([
    // Orders taken today (not yet sales: Money counts what was delivered).
    { label: t("takenToday"), value: formatRupees(todays._sum.totalPaise ?? 0), href: "/farm/orders?tab=open", section: "money" },
    birdsNow != null && { label: t("birdsOnFarm"), value: String(birdsNow), href: "/farm/poultry", section: "poultry" },
    { label: t("open"), value: String(open), href: "/farm/orders?tab=open", section: "orders" },
    features.creditAccounts && { label: t("dues"), value: formatRupees([...balances.values()].filter((b) => b > 0).reduce((a, b) => a + b, 0)), href: "/farm/customers?dues=1", section: "customers" },
  ] as (Tile | false)[]).filter((x): x is Tile => !!x)

  // "Do these now": one big card per job, in the colour of the part of the app it opens.
  type Job = { key: string; section: SectionKey; icon: string; title: string; hint: string; href: string }
  const jobs: Job[] = [
    ...vaccinesDue.map((v) => ({
      key: `v-${v.id}`,
      section: "poultry" as const,
      icon: "vaccines",
      title: tv("jobTitle", { name: v.vaccine }),
      hint: `${v.batch.name} · #${v.batch.number} · ${v.dueDate === today ? tv("dueToday") : tv("lateSince", { day: dayLabel(v.dueDate!, locale, labels) })}`,
      href: "/farm/poultry/vaccines",
    })),
    ...(toConfirm > 0 && features.callConfirmation && staff.roles.some((r) => r === "owner" || r === "order_desk")
      ? [{ key: "confirm", section: "orders" as const, icon: "orders", title: t("jobConfirm", { count: toConfirm }), hint: t("jobConfirmHint"), href: "/farm/orders" }]
      : []),
    ...(needsRecord
      ? [{ key: "record", section: "today" as const, icon: features.poultryCare && birdsNow != null ? "batches" : "made", title: t("recordToday"), hint: t("recordTodayHint"), href: features.poultryCare && birdsNow != null ? "/farm/poultry" : "/farm/money/made" }]
      : []),
    ...(unreadMessages > 0 ? [{ key: "messages", section: "messages" as const, icon: "messages", title: t("unreadMessages", { count: unreadMessages }), hint: t("jobMessagesHint"), href: "/farm/messages" }] : []),
    ...(features.stockTracking && lowStock.length > 0
      ? [
          {
            key: "stock",
            section: "products" as const,
            icon: "products",
            title: t("jobLowStock", { count: lowStock.length }),
            hint: lowStock.map((p) => `${pick(locale, p.nameTa, p.nameEn)} (${p.stockQty} ${unitName(p.stockUnit)})`).join(", "),
            href: "/farm/catalogue",
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh seconds={60} />
      {features.pushNotifications && <EnablePush who="staff" />}
      <SectionHeader section="today" hint={new Intl.DateTimeFormat(locale === "ta" ? "ta-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date())} />

      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-bold text-muted-foreground">{jobs.length ? t("doNow") : t("allDone")}</h2>
        {jobs.map((j) => {
          const look = SECTION_LOOK[j.section]
          return (
            <Link key={j.key} href={j.href} className={cn("flex items-center gap-3 rounded-2xl border-2 border-transparent p-3 transition-transform active:scale-[0.99]", look.tint)}>
              <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", look.strong)}>
                <SectionIcon name={j.icon} className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg leading-tight font-bold">{j.title}</span>
                <span className="line-clamp-2 block text-sm text-muted-foreground">{j.hint}</span>
              </span>
              <ChevronRight className="size-6 shrink-0" aria-hidden />
            </Link>
          )
        })}
      </section>

      <InstallApp variant="banner" />

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const look = SECTION_LOOK[tile.section]
          const body = (
            <>
              <div className={cn("flex items-center gap-1.5 text-sm font-bold", look.text)}>
                <SectionIcon name={tile.section} className="size-4" /> {tile.label}
              </div>
              <div className="font-display text-3xl font-bold tabular-nums">{tile.value}</div>
            </>
          )
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="rounded-2xl border bg-card p-4 hover:bg-accent">
              {body}
            </Link>
          ) : (
            <div key={tile.label} className="rounded-2xl border bg-card p-4">
              {body}
            </div>
          )
        })}
      </div>

      {features.subscriptions && (
        <section className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("plans")}</h2>
            <Link href="/farm/plans" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t("plansOpen", { count: activePlans })}
            </Link>
          </div>
          {planRun && planRun.created.length > 0 && <p className="text-sm">{t("plansCreated", { count: planRun.created.length })}</p>}
          {planRun?.held.map((h) => (
            <p key={`${h.planId}${h.date}`} className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {t("planHeld", { name: h.customerName, date: dayLabel(h.date, locale, { today: tc("today"), tomorrow: tc("tomorrow") }) })} — {te.has(h.reason) ? te(h.reason) : h.reason}
            </p>
          ))}
        </section>
      )}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("packing")}</h2>
        {packing.size === 0 ? (
          <p className="text-muted-foreground">{t("nothingToPack")}</p>
        ) : (
          <ul className="divide-y divide-dashed">
            {[...packing.values()].map((r) => (
              <li key={`${r.name}${r.pack}`} className="flex justify-between gap-3 py-2">
                <span>
                  {r.name} <span className="text-muted-foreground">· {r.pack}</span>
                </span>
                <b className="tabular-nums">{r.qty}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-lg font-semibold">{t("runs")}</h2>
        {runs.size === 0 ? (
          <p className="text-muted-foreground">{t("noRuns")}</p>
        ) : (
          <ul className="divide-y divide-dashed">
            {[...runs.entries()].map(([key, r]) => (
              <li key={key} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  {r.label}
                  <span className="block text-sm text-muted-foreground">{r.stops.join(", ")}</span>
                </span>
                <b className="shrink-0">{t("stops", { count: r.stops.length })}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
