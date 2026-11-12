"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requirePlatformAdmin, requireStaff } from "@/lib/auth"
import { cleanParams, RECIPE_KEYS, RECIPES } from "@/domain/automations"
import { saveRecipeSetting } from "@/server/automation"
import { noteSupportWrite } from "@/server/support"

/** Automation switches and numbers: a farm owner for the farm's own recipes; Farm For You admin for the defaults. */

type Result = { ok: true } | { ok: false; error: string }
const schema = z.object({ recipe: z.enum(RECIPE_KEYS), enabled: z.boolean(), params: z.record(z.string(), z.number()) })

export async function saveFarmRecipeAction(raw: unknown): Promise<Result> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success || RECIPES[parsed.data.recipe].scope !== "farm") return { ok: false, error: "invalid_form" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  await saveRecipeSetting(tenant.id, parsed.data.recipe, parsed.data.enabled, cleanParams(parsed.data.recipe, parsed.data.params))
  await noteSupportWrite(tenant.id, "AutomationSetting", "update", { id: parsed.data.recipe })
  revalidatePath("/farm", "layout")
  return { ok: true }
}

export async function savePlatformRecipeAction(raw: unknown): Promise<Result> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  await requirePlatformAdmin()
  await saveRecipeSetting(null, parsed.data.recipe, parsed.data.enabled, cleanParams(parsed.data.recipe, parsed.data.params))
  revalidatePath("/", "layout")
  return { ok: true }
}
