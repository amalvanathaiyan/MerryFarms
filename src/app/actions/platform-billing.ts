"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin } from "@/lib/auth"
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_TONES, GST_RATES } from "@/domain/platform-billing"
import { OrderError } from "@/server/orders"
import { adminActor } from "@/server/audit"
import { createInvoice, endAnnouncement, recordPayment, removePayment, saveAnnouncement, saveBillingProfile, voidInvoice } from "@/server/platform-billing"

/** Farm For You admin: billing details and GST switch, invoices, payments, announcements. Each checks the caller first. */

type Result = { ok: true; id?: string } | { ok: false; error: string }

async function attempt(fn: () => Promise<Result>): Promise<Result> {
  try {
    const r = await fn()
    revalidatePath("/admin", "layout")
    revalidatePath("/farm", "layout")
    return r
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[billing]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const paise = z.number().int().min(1).max(100_000_000)

export async function saveBillingProfileAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      address: z.string().max(300),
      phone: z.string().max(20),
      email: z.string().max(120),
      upiId: z.string().max(80),
      bank: z.string().max(300),
      dueDays: z.number().int().min(0).max(90),
      gstOn: z.boolean(),
      gstin: z.string().max(15),
      gstRatePct: z.number().refine((n) => (GST_RATES as readonly number[]).includes(n)),
      sac: z.string().max(8),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await saveBillingProfile(parsed.data, adminActor(admin))
    return { ok: true }
  })
}

export async function createInvoiceAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      tenantId: z.string().min(1),
      lines: z.array(z.object({ text: z.string().trim().min(1).max(120), amountPaise: paise })).min(1).max(20),
      periodStart: day.nullable(),
      periodEnd: day.nullable(),
      dueOn: day.nullable(),
      otherState: z.boolean(),
      notes: z.string().max(500).nullable(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    const inv = await createInvoice(parsed.data, adminActor(admin))
    return { ok: true, id: inv.id }
  })
}

export async function recordPaymentAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({ invoiceId: z.string().min(1), amountPaise: paise, method: z.enum(["upi", "bank", "cash", "other"]), reference: z.string().max(80).nullable(), paidOn: day })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await recordPayment(parsed.data, adminActor(admin))
    return { ok: true }
  })
}

export async function removePaymentAction(id: string): Promise<Result> {
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await removePayment(id, adminActor(admin))
    return { ok: true }
  })
}

export async function voidInvoiceAction(id: string, reason: string): Promise<Result> {
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await voidInvoice(id, String(reason ?? ""), adminActor(admin))
    return { ok: true }
  })
}

export async function saveAnnouncementAction(id: string | null, raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      titleTa: z.string().trim().min(1).max(120),
      titleEn: z.string().trim().min(1).max(120),
      bodyTa: z.string().trim().max(600).nullable(),
      bodyEn: z.string().trim().max(600).nullable(),
      tone: z.enum(ANNOUNCEMENT_TONES),
      audience: z.enum(ANNOUNCEMENT_AUDIENCES),
      onlyFarms: z.array(z.string().min(1)).max(500),
      startsOn: day,
      endsOn: day.nullable(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const admin = await requirePlatformAdmin()
  const d = parsed.data
  return attempt(async () => {
    const a = await saveAnnouncement(id, { ...d, bodyTa: d.bodyTa || null, bodyEn: d.bodyEn || null }, adminActor(admin))
    return { ok: true, id: a.id }
  })
}

export async function endAnnouncementAction(id: string): Promise<Result> {
  const admin = await requirePlatformAdmin()
  return attempt(async () => {
    await endAnnouncement(id, adminActor(admin))
    return { ok: true }
  })
}
