"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { checkTemplate, TEMPLATE_KEYS, type TemplateKey } from "@/domain/templates"

const schema = z.object({
  key: z.enum(TEMPLATE_KEYS as [TemplateKey, ...TemplateKey[]]),
  bodyTa: z.string().max(1000),
  bodyEn: z.string().max(1000),
})

type Result = { ok: true } | { ok: false; error: string; lang?: "ta" | "en"; unknown?: string[] }

/** The owner saves their own wording for a message. An empty language falls back to the default. */
export async function saveTemplate(raw: unknown): Promise<Result> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { key, bodyTa, bodyEn } = parsed.data
  for (const [lang, text] of [["ta", bodyTa], ["en", bodyEn]] as const) {
    if (!text.trim()) continue
    const problem = checkTemplate(key, text)
    if (problem === "too_long") return { ok: false, error: "template_too_long", lang }
    if (problem && problem !== "empty") return { ok: false, error: "template_unknown", lang, unknown: problem.unknown }
  }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const data = { bodyTa: bodyTa.trim() || null, bodyEn: bodyEn.trim() || null }
  await db.messageTemplate.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key } },
    update: data,
    create: { tenantId: tenant.id, key, ...data },
  })
  revalidatePath("/farm", "layout")
  return { ok: true }
}

/** Back to the built-in wording. */
export async function resetTemplate(key: string): Promise<Result> {
  if (!TEMPLATE_KEYS.includes(key as TemplateKey)) return { ok: false, error: "invalid" }
  const { db } = await requireStaff(OWNER_ONLY)
  await db.messageTemplate.deleteMany({ where: { key } })
  revalidatePath("/farm", "layout")
  return { ok: true }
}
