"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MAX_PHOTO_BYTES, sniffImage } from "@/domain/product-art"
import { DRAWINGS, MAX_SHOP_ART } from "@/components/art/drawing-library"

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
  await prisma.tenantLogo.upsert({ where: { tenantId: tenant.id }, update: { mime, data: bytes }, create: { tenantId: tenant.id, mime, data: bytes } })
  await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl: `/img/logo?v=${Date.now()}` } })
  return refresh()
}

export async function removeFarmLogo(): Promise<Result> {
  const { tenant } = await requireStaff(OWNER_ONLY)
  await prisma.tenantLogo.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.tenant.update({ where: { id: tenant.id }, data: { logoUrl: null } })
  return refresh()
}

/** The owner's pick of shop drawings, in their order. An empty pick goes back to the default for the farm's products. */
export async function setShopArt(raw: unknown): Promise<Result> {
  const parsed = z.array(z.string().max(40)).max(MAX_SHOP_ART).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "too_many_drawings" }
  if (parsed.data.some((id) => !DRAWINGS.has(id))) return { ok: false, error: "invalid_form" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  await prisma.tenant.update({ where: { id: tenant.id }, data: { shopArt: [...new Set(parsed.data)] } })
  return refresh()
}
