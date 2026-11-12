import "server-only"
import { prisma } from "@/lib/prisma"
import { statusLabel } from "@/domain/tenants"
import { checkServices, FREE_LIMITS, monthlyFeePaise, tickHealth, fillLevel } from "@/domain/admin-overview"
import { otpProvider } from "./otp"
import { listFarms } from "./platform"

const DAY = 86_400_000

/**
 * Admin's dashboard (docs/platform-plan.md §3.6): farms and their state, subscriptions and monthly fees, trials
 * ending, orders and sales across farms, new customers, requests, the automation engine, and the latest changes.
 */
export async function adminDashboard(now = new Date()) {
  const since30 = new Date(now.getTime() - 30 * DAY)
  const since24h = new Date(now.getTime() - DAY)
  const [farms, subs, newCustomers, newFarms, requests, pendingRequests, lastTick, failedJobs, alerts, recent] = await Promise.all([
    listFarms(now),
    prisma.farmSubscription.findMany({ include: { plan: { select: { nameTa: true, nameEn: true, monthlyPaise: true, yearlyPaise: true } }, tenant: { select: { id: true, nameTa: true, nameEn: true } } } }),
    prisma.customer.count({ where: { createdAt: { gte: since30 } } }),
    prisma.tenant.count({ where: { createdAt: { gte: since30 } } }),
    prisma.farmRequest.findMany({ where: { status: "pending" }, orderBy: { createdAt: "desc" }, take: 5, include: { tenant: { select: { nameTa: true, nameEn: true } } } }),
    prisma.farmRequest.count({ where: { status: "pending" } }),
    prisma.job.findFirst({ where: { type: "tick", status: "done" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } }),
    prisma.job.count({ where: { status: "failed", updatedAt: { gte: since24h } } }),
    prisma.automationNotice.count({ where: { createdAt: { gte: since24h } } }),
    prisma.auditEntry.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ])
  const labels = farms.map((f) => statusLabel(f.status, f.trialEndsAt, now))
  const in7 = new Date(now.getTime() + 7 * DAY)
  return {
    farms: {
      total: farms.length,
      trial: labels.filter((l) => l === "trial").length,
      trialOver: labels.filter((l) => l === "trial_over").length,
      active: labels.filter((l) => l === "active").length,
      suspended: labels.filter((l) => l === "suspended").length,
      new30: newFarms,
    },
    subscriptions: {
      byStatus: Object.fromEntries(["trial", "active", "past_due", "paused", "ended"].map((s) => [s, subs.filter((x) => x.status === s).length])),
      monthlyPaise: subs.reduce((a, s) => a + monthlyFeePaise(s, s.plan), 0),
      trialsEnding: subs
        .filter((s) => s.status === "trial" && s.trialEndsAt && s.trialEndsAt >= now && s.trialEndsAt <= in7)
        .sort((a, b) => a.trialEndsAt!.getTime() - b.trialEndsAt!.getTime())
        .map((s) => ({ tenantId: s.tenantId, nameTa: s.tenant.nameTa, nameEn: s.tenant.nameEn, endsAt: s.trialEndsAt!, planTa: s.plan.nameTa, planEn: s.plan.nameEn })),
    },
    selling: {
      orders30: farms.reduce((a, f) => a + f.orders30, 0),
      sales30Paise: farms.reduce((a, f) => a + f.sales30Paise, 0),
      newCustomers30: newCustomers,
      quietFarms: farms.filter((f) => !f.lastOrderAt || f.lastOrderAt < since30).length,
    },
    requests: { pending: pendingRequests, latest: requests },
    automation: { lastTickAt: lastTick?.finishedAt ?? null, tick: tickHealth(lastTick?.finishedAt ?? null, now), failedJobs24h: failedJobs, alerts24h: alerts },
    recent,
  }
}

const n = (v: unknown) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0))

/** A read that may not work on every database (storage is Supabase's own schema): null instead of failing the page. */
async function maybe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch {
    return null
  }
}

/**
 * The tech monitor: which service keys are set (never their values), the version running and where, database and
 * file storage against the free limits with rows per table, and how the job engine is doing.
 */
export async function techMonitor(now = new Date()) {
  const since24h = new Date(now.getTime() - DAY)
  const [dbBytes, tables, storage, lastTick, jobs24h, lastDone, failures, pending] = await Promise.all([
    maybe(async () => n((await prisma.$queryRaw<{ bytes: bigint }[]>`select pg_database_size(current_database()) as bytes`)[0]?.bytes)),
    maybe(async () =>
      (await prisma.$queryRaw<{ name: string; rows: bigint }[]>`select relname as name, n_live_tup as rows from pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc, relname`).map((r) => ({ name: r.name, rows: n(r.rows) }))
    ),
    maybe(async () => {
      const r = (await prisma.$queryRaw<{ bytes: bigint; files: bigint }[]>`select coalesce(sum((metadata->>'size')::bigint), 0) as bytes, count(*) as files from storage.objects`)[0]
      return { bytes: n(r?.bytes), files: n(r?.files) }
    }),
    prisma.job.findFirst({ where: { type: "tick", status: "done" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } }),
    prisma.job.groupBy({ by: ["status"], where: { updatedAt: { gte: since24h } }, _count: { _all: true } }),
    prisma.job.groupBy({ by: ["type"], where: { status: "done" }, _max: { finishedAt: true } }),
    prisma.job.findMany({ where: { status: "failed" }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, type: true, tenantId: true, attempts: true, lastError: true, updatedAt: true } }),
    prisma.job.count({ where: { status: "pending", runAt: { lte: now } } }),
  ])
  const env = process.env
  const sha = env.VERCEL_GIT_COMMIT_SHA
  return {
    version: {
      host: env.VERCEL ? "Vercel" : "local",
      environment: env.VERCEL_ENV ?? env.NODE_ENV ?? "development",
      region: env.VERCEL_REGION ?? null,
      commit: sha ? sha.slice(0, 7) : null,
      branch: env.VERCEL_GIT_COMMIT_REF ?? null,
      message: env.VERCEL_GIT_COMMIT_MESSAGE ? env.VERCEL_GIT_COMMIT_MESSAGE.split("\n")[0].slice(0, 120) : null,
      node: process.version,
    },
    services: checkServices((name) => !!env[name]),
    providers: {
      otp: otpProvider(),
      whatsapp: env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID ? "cloud" : null,
      push: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? "web_push" : null,
    },
    database: dbBytes == null ? null : { bytes: dbBytes, limit: FREE_LIMITS.databaseBytes, ...fillLevel(dbBytes, FREE_LIMITS.databaseBytes) },
    storage: storage == null ? null : { ...storage, limit: FREE_LIMITS.storageBytes, ...fillLevel(storage.bytes, FREE_LIMITS.storageBytes) },
    tables: tables ?? [],
    jobs: {
      lastTickAt: lastTick?.finishedAt ?? null,
      tick: tickHealth(lastTick?.finishedAt ?? null, now),
      last24h: Object.fromEntries(jobs24h.map((j) => [j.status, j._count._all])) as Record<string, number>,
      waiting: pending,
      lastDone: lastDone.map((j) => ({ type: j.type, at: j._max.finishedAt })).sort((a, b) => a.type.localeCompare(b.type)),
      failures,
    },
  }
}

export const AUDIT_PAGE = 50

/** The audit log, newest first: for one farm ("platform" = changes not about a farm), one family of actions, older than a time. */
export async function auditLog(f: { farm?: string; group?: string; before?: Date }) {
  const rows = await prisma.auditEntry.findMany({
    where: {
      ...(f.farm === "platform" ? { tenantId: null } : f.farm ? { tenantId: f.farm } : {}),
      ...(f.group ? { action: { startsWith: `${f.group}.` } } : {}),
      ...(f.before ? { createdAt: { lt: f.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: AUDIT_PAGE + 1,
  })
  return { rows: rows.slice(0, AUDIT_PAGE), more: rows.length > AUDIT_PAGE }
}
