"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requirePlatformAdmin, requireStaff } from "@/lib/auth"
import { saveFarmSettings, savePlatformSettings, saveSettingControl, SettingsError } from "@/server/settings"
import { staffActor } from "@/server/audit"
import { noteSupportWrite } from "@/server/support"

/** The settings registry's saves: a farm owner for the farm's own values; Farm For You admin for every farm's. */

type Result = { ok: true; changed: number } | { ok: false; error: string }
const value = z.union([z.boolean(), z.number(), z.string(), z.null()])
const changesSchema = z.record(z.string(), value)

const fail = (e: unknown): Result => {
  if (e instanceof SettingsError) return { ok: false, error: e.code === "not_allowed" ? "setting_locked" : "invalid_form" }
  throw e
}

/** The owner saves some of the farm's settings; null puts one back to the usual. */
export async function saveFarmSettingsAction(raw: unknown): Promise<Result> {
  const parsed = changesSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { tenant, staff, support } = await requireStaff(OWNER_ONLY)
  try {
    const changed = await saveFarmSettings(tenant.id, parsed.data, staffActor(staff, support))
    if (changed) await noteSupportWrite(tenant.id, "SettingValue", "update", { id: tenant.id })
    revalidatePath("/farm", "layout")
    return { ok: true, changed }
  } catch (e) {
    return fail(e)
  }
}

const platformSchema = z.object({
  key: z.string(),
  value,
  control: z.object({ locked: z.boolean(), hidden: z.boolean(), onlyFarms: z.array(z.string().max(64)).max(500) }),
})

/** Farm For You admin saves one setting: its value for every farm and its lock, hiding and first farms. */
export async function savePlatformSettingAction(raw: unknown): Promise<Result> {
  const parsed = platformSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  const actor = { kind: "platform_admin" as const, id: admin.id, name: admin.name }
  try {
    const changed = (await savePlatformSettings({ [parsed.data.key]: parsed.data.value }, actor)) + Number(await saveSettingControl(parsed.data.key, parsed.data.control, actor))
    revalidatePath("/", "layout")
    return { ok: true, changed }
  } catch (e) {
    return fail(e)
  }
}
