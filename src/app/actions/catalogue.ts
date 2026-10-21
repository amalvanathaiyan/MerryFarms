"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { rupeesToPaise } from "@/domain/money"

export type ActionResult = { ok: true } | { ok: false; error: string }

const done = (): ActionResult => {
  revalidatePath("/farm", "layout")
  revalidatePath("/")
  return { ok: true }
}

const categorySchema = z.object({
  nameTa: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
})

export async function addCategory(raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "category_names_required" }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const count = await db.category.count()
  await db.category.create({ data: { ...parsed.data, sortOrder: count, tenantId: tenant.id } })
  return done()
}

const productSchema = z.object({
  id: z.string().optional(),
  categoryId: z.string().min(1),
  nameTa: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  packTa: z.string().trim().min(1).max(60),
  packEn: z.string().trim().min(1).max(60),
  noteTa: z.string().trim().max(120).optional(),
  noteEn: z.string().trim().max(120).optional(),
  priceRupees: z.number().positive().max(1_000_000),
  stockQty: z.number().int().min(0).max(1_000_000),
  stockUnit: z.string().trim().min(1).max(20),
  gstRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18)]),
  hsn: z.string().trim().max(10).optional(),
  isActive: z.boolean(),
})

/** Adds or edits a product. Tamil and English names are both required. */
export async function saveProduct(raw: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "product_invalid" }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const { id, priceRupees, ...rest } = parsed.data

  const category = await db.category.findFirst({ where: { id: rest.categoryId } })
  if (!category) return { ok: false, error: "category_not_found" }

  const data = {
    ...rest,
    noteTa: rest.noteTa || null,
    noteEn: rest.noteEn || null,
    hsn: rest.hsn || null,
    pricePaise: rupeesToPaise(priceRupees),
  }
  if (id) {
    const r = await db.product.updateMany({ where: { id, deletedAt: null }, data })
    if (r.count !== 1) return { ok: false, error: "product_not_found" }
  } else {
    await db.product.create({ data: { ...data, tenantId: tenant.id } })
  }
  return done()
}

const quickSchema = z.object({
  id: z.string().min(1),
  priceRupees: z.number().positive().max(1_000_000).optional(),
  stockQty: z.number().int().min(0).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
})

/** Inline edits from the catalogue list: price, stock, shown in shop. */
export async function quickUpdateProduct(raw: unknown): Promise<ActionResult> {
  const parsed = quickSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { id, priceRupees, stockQty, isActive } = parsed.data
  // Packing staff may update stock; price and visibility are the owner's call.
  const ownerOnly = priceRupees !== undefined || isActive !== undefined
  const { db } = await requireStaff(ownerOnly ? OWNER_ONLY : ["owner", "packing"])
  const r = await db.product.updateMany({
    where: { id, deletedAt: null },
    data: {
      ...(priceRupees !== undefined && { pricePaise: rupeesToPaise(priceRupees) }),
      ...(stockQty !== undefined && { stockQty }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  if (r.count !== 1) return { ok: false, error: "product_not_found" }
  return done()
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  // Soft delete: past orders and invoices still show the product.
  await db.product.updateMany({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  return done()
}
