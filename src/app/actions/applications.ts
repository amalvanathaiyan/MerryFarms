"use server"

import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin } from "@/lib/auth"
import { normaliseIndianMobile } from "@/domain/phone"
import { APPLICATION_STATES } from "@/domain/applications"
import { OrderError } from "@/server/orders"
import { adminActor } from "@/server/audit"
import { moveApplication, saveReview, submitApplication } from "@/server/applications"

/** A farm registering itself (public, from the home page), and admin's review of it. */

type Result = { ok: true; number?: number; again?: boolean } | { ok: false; error: string }

async function attempt(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[applications]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

const text = (max: number) => z.string().trim().min(1).max(max)
const optional = (max: number) => z.string().trim().max(max).nullable().optional()

export async function applyAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      ownerName: text(60),
      phone: text(20),
      email: text(120),
      nameTa: text(80),
      nameEn: optional(80),
      modules: z.array(z.string()).max(10),
      district: text(60),
      address: text(300),
      pincode: z.string().trim().regex(/^\d{6}$/),
      lat: z.number().min(-90).max(90).nullable(),
      lng: z.number().min(-180).max(180).nullable(),
      fssai: optional(20),
      gstin: optional(20),
      pan: optional(12),
      planId: z.string().max(40).nullable(),
      message: optional(500),
      language: z.enum(["ta", "en"]),
      agreed: z.literal(true),
      /** Left empty by people; bots fill every field */
      website: z.string().max(0).optional(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = normaliseIndianMobile(parsed.data.phone)
  if (!phone) return { ok: false, error: "phone_invalid" }
  // Where it came from, kept only as a one-way hash, to stop floods
  const h = await headers()
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || ""
  const sourceHash = ip ? createHash("sha256").update(`ffy-join:${ip}`).digest("hex").slice(0, 32) : null
  return attempt(async () => {
    const { agreed: _a, website: _w, ...input } = parsed.data
    const r = await submitApplication(
      { ...input, phone, nameEn: input.nameEn ?? null, fssai: input.fssai ?? null, gstin: input.gstin ?? null, pan: input.pan ?? null, message: input.message ?? null },
      sourceHash
    )
    revalidatePath("/admin", "layout")
    return { ok: true, ...r }
  })
}

export async function saveReviewAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().min(1), checklist: z.record(z.string(), z.boolean()), notes: optional(2000) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await saveReview(parsed.data.id, { checklist: parsed.data.checklist, notes: parsed.data.notes ?? null }, adminActor(admin))
    revalidatePath("/admin", "layout")
    return { ok: true }
  })
}

export async function moveApplicationAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ id: z.string().min(1), to: z.enum(APPLICATION_STATES), reply: optional(1000) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await moveApplication(parsed.data.id, parsed.data.to, parsed.data.reply ?? null, adminActor(admin))
    revalidatePath("/admin", "layout")
    return { ok: true }
  })
}
