import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { tenantDb } from "@/lib/tenant-db"
import { featuresOf, farmModules } from "@/lib/features"
import { waitMarks, type RecipeKey } from "@/domain/automations"
import { orderCode } from "@/domain/orders"
import { istDate } from "@/domain/ist"
import { ownerTrialEndingNote, staffLowStockNote, staffOrdersWaitingNote } from "@/domain/notifications"
import { notifyStaff } from "./notify"
import { emitEvent } from "./events"
import { loadSettings } from "./settings"

export { emitEvent }

/**
 * The automation engine (docs/platform-plan.md §5). One tick, every ~10 minutes (/api/cron/tick):
 *   1. runs due jobs from the queue (with retries),
 *   2. runs each recipe for each farm that has it on (its switches and numbers are settings in the registry),
 *   3. records itself as a "tick" job, so admin can see the engine is alive.
 * Alerts go out once (automation_notices). Nothing here may stop an order or a page: every step is caught.
 */

/** True the first time for this subject, false after: an alert goes out once. */
async function firstTime(tenantId: string, recipe: RecipeKey, subjectKey: string) {
  const r = await prisma.automationNotice.createMany({ data: [{ tenantId, recipe, subjectKey }], skipDuplicates: true })
  return r.count === 1
}

// ── Recipes ──────────────────────────────────────────────────────────────────

type Farm = Awaited<ReturnType<typeof activeFarms>>[number]

async function activeFarms() {
  return prisma.tenant.findMany({ where: { status: { not: "suspended" } }, omit: { whatsappAccessToken: true } })
}

/** Orders still not confirmed after the red mark: staff are told once for each order. */
async function orderWaiting(farm: Farm, redHours: number, now: Date) {
  const since = new Date(now.getTime() - redHours * 3_600_000)
  const late = await tenantDb(farm.id).order.findMany({ where: { status: "to_confirm", createdAt: { lte: since } }, select: { id: true, number: true }, orderBy: { createdAt: "asc" }, take: 50 })
  const fresh: string[] = []
  for (const o of late) if (await firstTime(farm.id, "orderWaiting", o.id)) fresh.push(orderCode(farm.invoicePrefix, o.number))
  if (fresh.length) await notifyStaff(farm.id, staffOrdersWaitingNote(fresh, redHours))
  return fresh.length
}

/** Products down to the farm's mark: packing staff and owner are told once a day for each. */
async function lowStock(farm: Farm, atOrBelow: number, now: Date) {
  const low = await tenantDb(farm.id).product.findMany({ where: { deletedAt: null, isActive: true, stockQty: { lte: atOrBelow } }, select: { id: true, nameTa: true, nameEn: true }, take: 50 })
  const today = istDate(now)
  const fresh: string[] = []
  for (const x of low) if (await firstTime(farm.id, "lowStock", `${x.id}:${today}`)) fresh.push(farm.defaultLanguage === "en" ? x.nameEn : x.nameTa)
  if (fresh.length) await notifyStaff(farm.id, staffLowStockNote(fresh), ["owner", "packing"])
  return fresh.length
}

/** Farm owners whose free trial ends within the platform's days: told once for that end date. */
async function trialEnding(daysBefore: number, now: Date) {
  const until = new Date(now.getTime() + daysBefore * 86_400_000)
  const subs = await prisma.farmSubscription.findMany({ where: { status: "trial", trialEndsAt: { gt: now, lte: until } }, select: { tenantId: true, trialEndsAt: true } })
  let sent = 0
  for (const s of subs) {
    const date = istDate(s.trialEndsAt!)
    if (!(await firstTime(s.tenantId, "trialEnding", date))) continue
    const days = Math.max(1, Math.ceil((s.trialEndsAt!.getTime() - now.getTime()) / 86_400_000))
    await notifyStaff(s.tenantId, ownerTrialEndingNote(days, date), ["owner"])
    await emitEvent("trial.ending", s.tenantId, { trialEndsOn: date, days })
    sent++
  }
  return sent
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

/** Work handlers by job type. Each must be safe to run again (a failed job is retried). */
const HANDLERS: Record<string, (job: { tenantId: string | null; payload: Prisma.JsonValue }) => Promise<void>> = {}

/** Queues work for later (runAt) or for the next tick. */
export async function enqueue(type: string, tenantId: string | null, payload: Record<string, unknown> = {}, runAt = new Date()) {
  return prisma.job.create({ data: { type, tenantId, payload: payload as Prisma.InputJsonValue, runAt } })
}

const MAX_ATTEMPTS = 5

async function runDueJobs(now: Date) {
  const due = await prisma.job.findMany({ where: { status: "pending", runAt: { lte: now }, type: { not: "tick" } }, orderBy: { runAt: "asc" }, take: 25 })
  let done = 0, failed = 0
  for (const job of due) {
    const handler = HANDLERS[job.type]
    await prisma.job.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } } })
    try {
      if (!handler) throw new Error(`no handler for ${job.type}`)
      await handler(job)
      await prisma.job.update({ where: { id: job.id }, data: { status: "done", finishedAt: new Date(), lastError: null } })
      done++
    } catch (e) {
      // Back off: 1, 4, 9, 16 minutes; then give up and show it as failed in admin
      const last = job.attempts + 1 >= MAX_ATTEMPTS
      await prisma.job.update({
        where: { id: job.id },
        data: { status: last ? "failed" : "pending", lastError: (e as Error).message.slice(0, 500), runAt: new Date(now.getTime() + (job.attempts + 1) ** 2 * 60_000), finishedAt: last ? new Date() : null },
      })
      failed++
    }
  }
  return { done, failed }
}

// ── The tick ─────────────────────────────────────────────────────────────────

export async function tick(now = new Date()) {
  const run = await prisma.job.create({ data: { type: "tick", status: "running", startedAt: now, runAt: now } })
  const summary: Record<string, number> = { farms: 0, ordersWaiting: 0, lowStock: 0, trialEnding: 0, jobsDone: 0, jobsFailed: 0, errors: 0 }
  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } catch (e) {
      summary.errors++
      console.error("[tick]", (e as Error).message)
    }
  }
  await guard(async () => {
    const j = await runDueJobs(now)
    summary.jobsDone = j.done
    summary.jobsFailed = j.failed
  })
  await guard(async () => {
    const platform = await loadSettings(null)
    if (platform.trialReminderOn.value) summary.trialEnding = await trialEnding(platform.trialReminderDays.value, now)
  })
  for (const farm of await activeFarms()) {
    summary.farms++
    await guard(async () => {
      const s = await loadSettings(farm.id)
      const modules = farmModules(farm)
      if (!modules.includes("selling")) return
      if (s.orderWaitingOn.value) summary.ordersWaiting += await orderWaiting(farm, waitMarks(s.orderYellowHours.value, s.orderRedHours.value).redHours, now)
      if (s.lowStockOn.value && featuresOf(farm).stockTracking) summary.lowStock += await lowStock(farm, s.lowStockAt.value, now)
    })
  }
  await prisma.job.update({ where: { id: run.id }, data: { status: summary.errors ? "failed" : "done", finishedAt: new Date(), payload: summary } })
  return summary
}
