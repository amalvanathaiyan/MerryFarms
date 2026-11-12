"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { noteSupportWrite } from "@/server/support"
import { MAX_PHOTO_BYTES, sniffImage } from "@/domain/product-art"
import { DRAWINGS, MAX_SHOP_ART } from "@/components/art/drawing-library"
import { cleanNameColours, MAX_NAME_COLOURS } from "@/domain/brand"
import { dropPhoto, storePhoto } from "@/server/photos"

/** The farm's look, set by its owner: logo, and the drawings that decorate its shop. */

type Result = { ok: true } | { ok: false; error: string }

const refresh = () => {
  revalidatePath("/", "layout")
  return { ok: true } as const
}

/** The logo arrives already shrunk on the phone (≤512 px); its type is checked from the bytes, not the name. */
export async function setFarmLogo(raw: unknown): Promise<Result> {
  const parsed = z.string().max(Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 100).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "photo_too_big" }
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/.exec(parsed.data)
  if (!m) return { ok: false, error: "photo_type" }
  const bytes = new Uint8Array(Buffer.from(m[1], "base64"))
  const mime = sniffImage(bytes)
  if (!mime) return { ok: false, error: "photo_type" }
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: "photo_too_big" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  const old = await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id }, select: { storagePath: true } })
  const stored = await storePhoto(tenant.id, "logo", "logo", bytes, mime)
  await prisma.tenantLogo.upsert({ where: { tenantId: tenant.id }, update: { mime, ...stored }, create: { tenantId: tenant.id, mime, ...stored } })
  await dropPhoto(old)
  await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl: `/img/logo?v=${Date.now()}` } })
  await noteSupportWrite(tenant.id, "TenantLogo", "update", { id: tenant.id })
  return refresh()
}

export async function removeFarmLogo(): Promise<Result> {
  const { tenant } = await requireStaff(OWNER_ONLY)
  await dropPhoto(await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id }, select: { storagePath: true } }))
  await prisma.tenantLogo.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl: null } })
  await noteSupportWrite(tenant.id, "TenantLogo", "delete", { id: tenant.id })
  return refresh()
}

const brandSchema = z.object({
  taglineTa: z.string().trim().max(60),
  taglineEn: z.string().trim().max(60),
  nameColours: z.array(z.string().max(9)).max(MAX_NAME_COLOURS),
  /** The app's colours; null = Farm For You's */
  theme: z.object({ primary: z.string().regex(/^#[0-9a-fA-F]{6}$/), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/) }).nullable().optional(),
})

/** The farm's tagline (Tamil and English), the colours its name's words take in turn, and its app colours. Empty = none. */
export async function setFarmBrand(raw: unknown): Promise<Result> {
  const parsed = brandSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const nameColours = cleanNameColours(parsed.data.nameColours)
  if (!nameColours) return { ok: false, error: "invalid_form" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      taglineTa: parsed.data.taglineTa || null,
      taglineEn: parsed.data.taglineEn || null,
      nameColours,
      ...(parsed.data.theme !== undefined && {
        themePrimary: parsed.data.theme?.primary.toUpperCase() ?? null,
        themeAccent: parsed.data.theme?.accent.toUpperCase() ?? null,
      }),
    },
  })
  await noteSupportWrite(tenant.id, "Tenant", "update", { id: tenant.id })
  return refresh()
}

/** The owner's pick of shop drawings, in their order. An empty pick goes back to the default for the farm's products. */
export async function setShopArt(raw: unknown): Promise<Result> {
  const parsed = z.array(z.string().max(40)).max(MAX_SHOP_ART).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "too_many_drawings" }
  if (parsed.data.some((id) => !DRAWINGS.has(id))) return { ok: false, error: "invalid_form" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  await prisma.tenant.update({ where: { id: tenant.id }, data: { shopArt: [...new Set(parsed.data)] } })
  await noteSupportWrite(tenant.id, "Tenant", "update", { id: tenant.id })
  return refresh()
}
