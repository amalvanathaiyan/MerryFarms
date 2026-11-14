"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin } from "@/lib/auth"
import { CASE_DECISIONS, RESTRICTED_ACTIONS } from "@/domain/compliance"
import { OrderError } from "@/server/orders"
import { adminActor } from "@/server/audit"
import { addStarterItems, decideCase, removeItem, saveComplianceConfig, saveItem } from "@/server/compliance"

/** Farm For You admin: the screening switch, the restricted items list and decisions on cases. Each checks the caller. */

type Result = { ok: true; count?: number } | { ok: false; error: string }

async function attempt(fn: () => Promise<Result>): Promise<Result> {
  try {
    const r = await fn()
    revalidatePath("/admin", "layout")
    revalidatePath("/farm", "layout")
    revalidatePath("/")
    return r
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[compliance]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

export async function saveComplianceConfigAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ on: z.boolean(), repeatLimit: z.number().int().min(1).max(20) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await saveComplianceConfig(parsed.data, adminActor(admin))
    return { ok: true }
  })
}

export async function saveItemAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: z.string().min(1).nullable(),
      labelTa: z.string().trim().min(1).max(80),
      labelEn: z.string().trim().min(1).max(80),
      wordsTa: z.string().max(2000),
      wordsEn: z.string().max(2000),
      action: z.enum(RESTRICTED_ACTIONS),
      reasonTa: z.string().trim().min(1).max(300),
      reasonEn: z.string().trim().min(1).max(300),
      active: z.boolean(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  const { id, ...input } = parsed.data
  return attempt(async () => {
    await saveItem(id, input, adminActor(admin))
    return { ok: true }
  })
}

export async function removeItemAction(id: string): Promise<Result> {
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await removeItem(id, adminActor(admin))
    return { ok: true }
  })
}

export async function addStarterItemsAction(): Promise<Result> {
  const admin = await requirePlatformAdmin()
  return attempt(async () => ({ ok: true, count: await addStarterItems(adminActor(admin)) }))
}

export async function decideCaseAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().min(1), decision: z.enum(CASE_DECISIONS), note: z.string().trim().max(500).nullable() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await decideCase(parsed.data.id, parsed.data.decision, parsed.data.note, adminActor(admin))
    return { ok: true }
  })
}
