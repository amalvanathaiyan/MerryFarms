import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  cleanValue,
  isSettingKey,
  NO_CONTROL,
  resolveAll,
  resolveSetting,
  SETTING_KEYS,
  SETTINGS,
  type AnyValue,
  type ResolvedSettings,
  type SettingControl,
  type SettingDef,
  type SettingKey,
  type StoredValue,
} from "@/domain/settings"
import { audit, type Actor } from "./audit"
import { emitEvent } from "./events"

/**
 * Loads and saves the settings registry (src/domain/settings.ts). Values live in setting_values, keyed by whose they
 * are; Farm For You's locks, hiding and first-farms lists in setting_controls. Every change goes to the audit log.
 */

export const farmScope = (tenantId: string) => `farm:${tenantId}`
export const userScope = (kind: "staff" | "customer", id: string) => `${kind}:${id}`

async function controls(): Promise<Record<string, SettingControl>> {
  const rows = await prisma.settingControl.findMany()
  return Object.fromEntries(rows.map((r) => [r.key, { locked: r.locked, hidden: r.hidden, onlyFarms: r.onlyFarms }]))
}

/**
 * Every setting's value for a farm (null = Farm For You's own view), and for one person when given. Each comes with
 * where its value came from and whether the farm may change it: `(await loadSettings(id)).orderRedHours.value`.
 */
export async function loadSettings(tenantId: string | null, user?: { kind: "staff" | "customer"; id: string }): Promise<ResolvedSettings> {
  const scopes = ["platform", ...(tenantId ? [farmScope(tenantId)] : []), ...(user ? [userScope(user.kind, user.id)] : [])]
  const [rows, ctl] = await Promise.all([prisma.settingValue.findMany({ where: { scopeKey: { in: scopes } } }), controls()])
  const stored: StoredValue[] = rows.map((r) => ({ scope: r.scopeKey === "platform" ? "platform" : r.scopeKey.startsWith("farm:") ? "farm" : "user", key: r.key, value: r.value }))
  return resolveAll(stored, ctl, tenantId)
}

export class SettingsError extends Error {
  constructor(public code: "unknown_setting" | "not_allowed" | "invalid_value") {
    super(code)
  }
}

/** Writes or clears (value null) one scope's values, and records each real change in the audit log. */
async function write(scopeKey: string, tenantId: string | null, changes: { key: SettingKey; value: AnyValue | null }[], actor: Actor) {
  const keys = changes.map((c) => c.key)
  const before = new Map((await prisma.settingValue.findMany({ where: { scopeKey, key: { in: keys } } })).map((r) => [r.key, r.value]))
  const changed = changes.filter((c) => JSON.stringify(before.get(c.key) ?? null) !== JSON.stringify(c.value))
  if (!changed.length) return 0
  await prisma.$transaction(
    changed.map((c) =>
      c.value === null
        ? prisma.settingValue.deleteMany({ where: { scopeKey, key: c.key } })
        : prisma.settingValue.upsert({
            where: { scopeKey_key: { scopeKey, key: c.key } },
            create: { scopeKey, tenantId, key: c.key, value: c.value as Prisma.InputJsonValue },
            update: { value: c.value as Prisma.InputJsonValue },
          }),
    ),
  )
  await audit(
    actor,
    changed.map((c) => ({ tenantId, action: "setting.changed", subject: c.key, before: { scope: scopeKey.split(":")[0], value: before.get(c.key) ?? null }, after: { scope: scopeKey.split(":")[0], value: c.value } })),
  )
  await emitEvent("settings.changed", tenantId, { keys: changed.map((c) => c.key), scope: scopeKey.split(":")[0] })
  return changed.length
}

/** Checks and cleans one change; null clears the saved value (back to the usual). */
function cleanChange(key: string, value: unknown): { key: SettingKey; value: AnyValue | null } {
  if (!isSettingKey(key)) throw new SettingsError("unknown_setting")
  if (value === null) return { key, value: null }
  const clean = cleanValue(key, value)
  if (clean === undefined) throw new SettingsError("invalid_value")
  return { key, value: clean }
}

/** A farm owner (or support) changes the farm's own settings. Only settings the farm may change; null = back to the usual. */
export async function saveFarmSettings(tenantId: string, changes: Record<string, unknown>, actor: Actor) {
  const list = Object.entries(changes).map(([k, v]) => cleanChange(k, v))
  const current = await loadSettings(tenantId)
  for (const c of list) if (!current[c.key].farmMayChange) throw new SettingsError("not_allowed")
  return write(farmScope(tenantId), tenantId, list, actor)
}

/** A person changes their own value of a staff or customer setting. */
export async function saveUserSettings(tenantId: string, user: { kind: "staff" | "customer"; id: string }, changes: Record<string, unknown>, actor: Actor) {
  const list = Object.entries(changes).map(([k, v]) => cleanChange(k, v))
  const current = await loadSettings(tenantId, user)
  for (const c of list) if (!current[c.key].userMayChange || (SETTINGS[c.key] as SettingDef).who !== user.kind) throw new SettingsError("not_allowed")
  return write(userScope(user.kind, user.id), tenantId, list, actor)
}

/** Farm For You admin sets the value every farm gets (null = back to the registry's default). */
export async function savePlatformSettings(changes: Record<string, unknown>, actor: Actor) {
  return write("platform", null, Object.entries(changes).map(([k, v]) => cleanChange(k, v)), actor)
}

/** Farm For You admin locks, hides or limits a setting to first farms. Recorded in the audit log. */
export async function saveSettingControl(key: string, control: SettingControl, actor: Actor) {
  if (!isSettingKey(key)) throw new SettingsError("unknown_setting")
  const onlyFarms = [...new Set(control.onlyFarms.filter((id) => typeof id === "string" && id.length > 0))].sort()
  const next = { locked: !!control.locked, hidden: !!control.hidden, onlyFarms }
  const row = await prisma.settingControl.findUnique({ where: { key } })
  const before = row ? { locked: row.locked, hidden: row.hidden, onlyFarms: row.onlyFarms } : NO_CONTROL
  if (JSON.stringify(before) === JSON.stringify(next)) return false
  await prisma.settingControl.upsert({ where: { key }, create: { key, ...next }, update: next })
  await audit(actor, [{ tenantId: null, action: "setting.control", subject: key, before, after: next }])
  await emitEvent("settings.control", null, { key, ...next })
  return true
}

/** For admin: every setting's controls and Farm For You's value, plus how many farms set their own. */
export async function platformSettingsOverview() {
  const [ctl, platform, farmCounts] = await Promise.all([
    controls(),
    prisma.settingValue.findMany({ where: { scopeKey: "platform" } }),
    prisma.settingValue.groupBy({ by: ["key"], where: { scopeKey: { startsWith: "farm:" } }, _count: { _all: true } }),
  ])
  return SETTING_KEYS.map((key) => {
    const control = ctl[key] ?? NO_CONTROL
    const saved = platform.find((p) => p.key === key)
    return {
      key,
      control,
      resolved: resolveSetting(key, { platform: saved?.value }, control, null),
      farmsOwn: farmCounts.find((c) => c.key === key)?._count._all ?? 0,
    }
  })
}
