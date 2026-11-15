"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requirePlatformAdmin } from "@/lib/auth"
import { ART_KINDS } from "@/domain/product-art"
import { MODULE_KEYS } from "@/domain/modules"
import { detailsSchema, MEASURES, packsSchema } from "@/domain/product-kinds"
import { adminActor, audit } from "@/server/audit"
import { addStarterKinds, retireKind, saveKind } from "@/server/product-kinds"

type Result = { ok: true } | { ok: false; error: string }

const kindSchema = z.object({
  module: z.enum(MODULE_KEYS),
  nameTa: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  art: z.enum(ART_KINDS),
  measure: z.enum(MEASURES),
  packs: packsSchema,
  details: detailsSchema,
  weighedOnDelivery: z.boolean(),
  shelfLifeDays: z.number().int().min(0).max(3650).nullable(),
  hsn: z.string().trim().regex(/^\d{4,8}$/).nullable(),
  gstRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18)]),
})

/** Admin → Products: add or change a product kind. Detail keys must be unique within the kind. */
export async function saveKindAction(id: string | null, raw: unknown): Promise<Result> {
  const parsed = kindSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  if (new Set(parsed.data.details.map((d) => d.key)).size !== parsed.data.details.length) return { ok: false, error: "invalid_form" }
  if (parsed.data.details.some((d) => d.type === "choice" && d.choices.length < 2)) return { ok: false, error: "choices_needed" }
  const admin = await requirePlatformAdmin()
  const k = await saveKind(id, parsed.data)
  await audit(adminActor(admin), [{ tenantId: null, action: id ? "product_kind.changed" : "product_kind.created", subject: k.id, after: parsed.data }])
  revalidatePath("/admin/products")
  return { ok: true }
}

export async function retireKindAction(id: string, retired: boolean): Promise<Result> {
  const admin = await requirePlatformAdmin()
  await retireKind(id, retired)
  await audit(adminActor(admin), [{ tenantId: null, action: retired ? "product_kind.retired" : "product_kind.restored", subject: id }])
  revalidatePath("/admin/products")
  return { ok: true }
}

/** Loads Farm For You's starter list of product kinds (only those not there yet). */
export async function addStarterKindsAction(): Promise<Result> {
  const admin = await requirePlatformAdmin()
  const added = await addStarterKinds()
  await audit(adminActor(admin), [{ tenantId: null, action: "product_kind.starters_added", after: { added } }])
  revalidatePath("/admin/products")
  return { ok: true }
}
