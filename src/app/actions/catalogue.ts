"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { rupeesToPaise } from "@/domain/money"
import { MAX_PHOTO_BYTES, sniffImage } from "@/domain/product-art"
import { adjustPrice } from "@/domain/offers"
import { ART_KINDS } from "@/domain/product-art"
import { addEggs, putStock, removeStockUpTo, setEggStore, syncEggStock, type Tx } from "@/server/stock"
import { dropPhoto, storePhoto } from "@/server/photos"

export type ActionResult = { ok: true } | { ok: false; error: string }

const done = (): ActionResult => {
  revalidatePath("/farm", "layout")
  revalidatePath("/")
  return { ok: true }
}

const categorySchema = z.object({
  nameTa: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  kind: z.enum(ART_KINDS).optional(),
})

export async function addCategory(raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "category_names_required" }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const count = await db.category.count({ where: { deletedAt: null } })
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
  /** Egg products: eggs in one unit (30 in a tray). Their stock then comes from the farm's egg store. */
  eggsPerUnit: z.number().int().min(1).max(1000).nullable().optional(),
  gstRate: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18)]),
  hsn: z.string().trim().max(10).optional(),
  isActive: z.boolean(),
  /** Offer price in rupees; null or missing = no offer. */
  offerRupees: z.number().positive().max(1_000_000).nullable().optional(),
  offerEndsOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
})

/** Adds or edits a product. Tamil and English names are both required. */
export async function saveProduct(raw: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "product_invalid" }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const { id, priceRupees, offerRupees, offerEndsOn, stockQty, eggsPerUnit = null, ...rest } = parsed.data
  const offerPricePaise = offerRupees ? rupeesToPaise(offerRupees) : null
  if (offerPricePaise != null && offerPricePaise >= rupeesToPaise(priceRupees)) return { ok: false, error: "offer_not_lower" }

  const category = await db.category.findFirst({ where: { id: rest.categoryId, deletedAt: null } })
  if (!category) return { ok: false, error: "category_not_found" }

  const data = {
    ...rest,
    noteTa: rest.noteTa || null,
    noteEn: rest.noteEn || null,
    hsn: rest.hsn || null,
    pricePaise: rupeesToPaise(priceRupees),
    offerPricePaise,
    offerEndsOn: offerPricePaise != null && offerEndsOn ? offerEndsOn : null,
  }
  // An egg product's stock is the egg store's: a changed count moves eggs in the store (+1 tray = +30 eggs).
  const ok = await db.$transaction(async (tx) => {
    let productId = id
    if (id) {
      const before = await tx.product.findFirst({ where: { id, deletedAt: null }, select: { stockQty: true, eggsPerUnit: true } })
      if (!before) return false
      await tx.product.updateMany({ where: { id }, data: { ...data, eggsPerUnit, ...(eggsPerUnit ? {} : { stockQty }) } })
      if (eggsPerUnit && !before.eggsPerUnit) await joinEggStore(tx, tenant.id, stockQty, eggsPerUnit)
      else if (eggsPerUnit && before.eggsPerUnit !== eggsPerUnit) await syncEggStock(tx, tenant.id)
      else if (eggsPerUnit) await moveTo(tx, tenant.id, id, before.stockQty, stockQty)
    } else {
      const created = await tx.product.create({ data: { ...data, eggsPerUnit, stockQty: eggsPerUnit ? 0 : stockQty, tenantId: tenant.id } })
      productId = created.id
      if (eggsPerUnit) await joinEggStore(tx, tenant.id, stockQty, eggsPerUnit)
    }
    return !!productId
  })
  if (!ok) return { ok: false, error: "product_not_found" }
  return done()
}

/**
 * A product that becomes an egg product brings its packed stock into the egg store: 14 trays of 30 are 420 real
 * eggs. Every egg product's count then follows the store.
 */
async function joinEggStore(tx: Tx, tenantId: string, packed: number, eggsPerUnit: number) {
  if (packed > 0) await addEggs(tx, tenantId, packed * eggsPerUnit)
  else await syncEggStock(tx, tenantId)
}

/** Brings an egg product to `wanted` units by moving eggs in the store (+1 tray = +30 eggs). */
async function moveTo(tx: Tx, tenantId: string, productId: string, current: number, wanted: number) {
  if (wanted > current) await putStock(tx, tenantId, productId, wanted - current)
  if (wanted < current) await removeStockUpTo(tx, tenantId, productId, current - wanted)
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
  const { db, tenant } = await requireStaff(ownerOnly ? OWNER_ONLY : ["owner", "packing"])
  const ok = await db.$transaction(async (tx) => {
    const p = await tx.product.findFirst({ where: { id, deletedAt: null }, select: { stockQty: true, eggsPerUnit: true } })
    if (!p) return false
    await tx.product.updateMany({
      where: { id },
      data: {
        ...(priceRupees !== undefined && { pricePaise: rupeesToPaise(priceRupees) }),
        ...(stockQty !== undefined && !p.eggsPerUnit && { stockQty }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    if (stockQty !== undefined && p.eggsPerUnit) await moveTo(tx, tenant.id, id, p.stockQty, stockQty)
    return true
  })
  if (!ok) return { ok: false, error: "product_not_found" }
  return done()
}

/** Owner and packing staff: the eggs counted in the store; every egg product's stock follows. */
export async function setEggStoreAction(raw: unknown): Promise<ActionResult> {
  const parsed = z.object({ eggs: z.number().int().min(0).max(10_000_000) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { db, tenant } = await requireStaff(["owner", "packing"])
  await db.$transaction((tx) => setEggStore(tx, tenant.id, parsed.data.eggs))
  return done()
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  // Soft delete: past orders and invoices still show the product.
  await db.product.updateMany({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
  return done()
}

/** Saves a product photo (already shrunk on the phone) sent as a data URL. */
export async function setProductPhoto(raw: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: z.string().min(1), dataUrl: z.string().max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 100) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "photo_too_big" }
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data.dataUrl)
  if (!m) return { ok: false, error: "photo_type" }
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"))
  const mime = sniffImage(bytes)
  if (!mime) return { ok: false, error: "photo_type" }
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: "photo_too_big" }
  const { db, tenant } = await requireStaff(OWNER_ONLY)
  const product = await db.product.findFirst({ where: { id: parsed.data.id, deletedAt: null } })
  if (!product) return { ok: false, error: "not_found" }
  const old = await db.productImage.findFirst({ where: { productId: product.id }, select: { storagePath: true } })
  const stored = await storePhoto(tenant.id, "images", product.id, bytes, mime)
  await db.productImage.upsert({
    where: { productId: product.id },
    update: { mime, ...stored },
    create: { productId: product.id, tenantId: tenant.id, mime, ...stored },
  })
  await dropPhoto(old)
  await db.product.update({ where: { id: product.id }, data: { imageUrl: `/img/p/${product.id}?v=${Date.now()}` } })
  return done()
}

export async function removeProductPhoto(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  const product = await db.product.findFirst({ where: { id } })
  if (!product) return { ok: false, error: "not_found" }
  await dropPhoto(await db.productImage.findFirst({ where: { productId: id }, select: { storagePath: true } }))
  await db.productImage.deleteMany({ where: { productId: id } })
  await db.product.update({ where: { id }, data: { imageUrl: null } })
  return done()
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function renameCategory(raw: unknown): Promise<ActionResult> {
  const parsed = categorySchema.extend({ id: z.string().min(1) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "category_names_required" }
  const { db } = await requireStaff(OWNER_ONLY)
  const { id, ...names } = parsed.data
  const r = await db.category.updateMany({ where: { id, deletedAt: null }, data: names })
  if (r.count !== 1) return { ok: false, error: "category_not_found" }
  return done()
}

/** Only an empty category can be removed (hide or move its products first). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  if ((await db.product.count({ where: { categoryId: id, deletedAt: null } })) > 0) return { ok: false, error: "category_not_empty" }
  await db.category.updateMany({ where: { id }, data: { deletedAt: new Date() } })
  return done()
}

/** Swaps an item with its neighbour in a list, renumbering the list 0, 1, 2… */
function reorder<T extends { id: string }>(list: T[], id: string, dir: "up" | "down"): T[] | null {
  const i = list.findIndex((x) => x.id === id)
  const j = dir === "up" ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= list.length) return null
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export async function moveCategory(id: string, dir: "up" | "down"): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  const list = await db.category.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } })
  const next = reorder(list, id, dir)
  if (!next) return { ok: true }
  await db.$transaction(async (tx) => {
    for (const [i, c] of next.entries()) await tx.category.updateMany({ where: { id: c.id }, data: { sortOrder: i } })
  })
  return done()
}

export async function moveProduct(id: string, dir: "up" | "down"): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  const product = await db.product.findFirst({ where: { id, deletedAt: null }, select: { categoryId: true } })
  if (!product) return { ok: false, error: "product_not_found" }
  const list = await db.product.findMany({
    where: { categoryId: product.categoryId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  })
  const next = reorder(list, id, dir)
  if (!next) return { ok: true }
  await db.$transaction(async (tx) => {
    for (const [i, p] of next.entries()) await tx.product.updateMany({ where: { id: p.id }, data: { sortOrder: i } })
  })
  return done()
}

// ── Prices for a whole category at once ──────────────────────────────────────

const bulkSchema = z.object({
  categoryId: z.string().min(1),
  mode: z.enum(["pct", "rupees"]),
  direction: z.enum(["up", "down"]),
  amount: z.number().positive().max(100_000),
})

/** Raises or lowers every list price in a category (offers are left as they are). */
export async function bulkAdjustPrices(raw: unknown): Promise<ActionResult> {
  const parsed = bulkSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid" }
  const { categoryId, ...a } = parsed.data
  if (a.mode === "pct" && a.amount > 90) return { ok: false, error: "invalid" }
  const { db } = await requireStaff(OWNER_ONLY)
  const products = await db.product.findMany({ where: { categoryId, deletedAt: null } })
  await db.$transaction(async (tx) => {
    for (const p of products) {
      const pricePaise = adjustPrice(p.pricePaise, a)
      // An offer that is no longer cheaper than the new price ends.
      const keepOffer = p.offerPricePaise != null && p.offerPricePaise < pricePaise
      await tx.product.updateMany({ where: { id: p.id }, data: { pricePaise, ...(keepOffer ? {} : { offerPricePaise: null, offerEndsOn: null }) } })
    }
  })
  return done()
}

/** Ends a product's offer now. */
export async function endOffer(id: string): Promise<ActionResult> {
  const { db } = await requireStaff(OWNER_ONLY)
  await db.product.updateMany({ where: { id }, data: { offerPricePaise: null, offerEndsOn: null } })
  return done()
}
