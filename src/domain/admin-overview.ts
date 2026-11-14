/**
 * Pure reckonings for Farm For You admin's dashboard and tech monitor (docs/platform-plan.md §3.6): monthly fees
 * from subscriptions, the checklist of service keys, and how close something is to a free limit.
 */

/** What a subscription brings in a month: its own price (or the plan's), a yearly price spread over 12 months. */
export function monthlyFeePaise(sub: { status: string; billingCycle: string; priceOverridePaise: number | null }, plan: { monthlyPaise: number; yearlyPaise: number | null }): number {
  if (sub.status !== "active" && sub.status !== "past_due") return 0
  if (sub.billingCycle === "yearly") {
    const yearly = sub.priceOverridePaise ?? plan.yearlyPaise ?? plan.monthlyPaise * 12
    return Math.round(yearly / 12)
  }
  return sub.priceOverridePaise ?? plan.monthlyPaise
}

/**
 * The services the app uses and the keys each needs. A key is only checked for being set, never shown. `required`:
 * the app can't run without it; the rest switch a feature on.
 */
export const SERVICES = [
  { key: "database", required: true, env: ["DATABASE_URL", "DIRECT_URL"] },
  { key: "supabase", required: true, env: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { key: "tick", required: true, env: ["CRON_SECRET"] },
  { key: "secrets", required: true, env: ["OTP_SECRET", "SUPPORT_SECRET"] },
  { key: "push", required: false, env: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] },
  { key: "whatsapp", required: false, env: ["WHATSAPP_API_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_OTP_TEMPLATE", "WHATSAPP_ALERT_TEMPLATE"] },
  { key: "sms", required: false, env: ["MSG91_AUTH_KEY", "MSG91_OTP_TEMPLATE_ID"] },
  { key: "maps", required: false, env: ["GEO_CONTACT_EMAIL"] },
] as const

export type ServiceKey = (typeof SERVICES)[number]["key"]
export type ServiceState = "ready" | "partly" | "missing"

export interface ServiceCheck {
  key: ServiceKey
  required: boolean
  state: ServiceState
  keys: { name: string; set: boolean }[]
}

/** Each service, with which of its keys are set (from a lookup that says only set or not). */
export function checkServices(isSet: (name: string) => boolean): ServiceCheck[] {
  return SERVICES.map((s) => {
    const keys = s.env.map((name) => ({ name, set: isSet(name) }))
    const n = keys.filter((k) => k.set).length
    return { key: s.key, required: s.required, state: n === keys.length ? "ready" : n === 0 ? "missing" : "partly", keys }
  })
}

/** Free limits of the hosts in use (Supabase free plan), in bytes. */
export const FREE_LIMITS = { databaseBytes: 500 * 1024 * 1024, storageBytes: 1024 * 1024 * 1024 } as const

export type FillLevel = "ok" | "watch" | "near"

/** How full something is against its limit: watch from 60%, near from 85%. */
export function fillLevel(used: number, limit: number): { pct: number; level: FillLevel } {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 0
  return { pct, level: pct >= 85 ? "near" : pct >= 60 ? "watch" : "ok" }
}

/** Whether the tick is running: it runs every 10 minutes, so a gap over 30 minutes means it has stopped. */
export function tickHealth(lastTickAt: Date | null, now: Date): "running" | "late" | "never" {
  if (!lastTickAt) return "never"
  return now.getTime() - lastTickAt.getTime() > 30 * 60_000 ? "late" : "running"
}

/** The family of an audit action ("plan.changed" → "plan"), for the audit log's filter. */
export const AUDIT_GROUPS = ["farm", "application", "plan", "subscription", "module", "request", "billing", "announcement", "support", "setting", "feature", "poultry"] as const
export type AuditGroup = (typeof AUDIT_GROUPS)[number]
export const auditGroup = (action: string): string => action.split(".")[0]
