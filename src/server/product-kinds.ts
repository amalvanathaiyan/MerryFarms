import "server-only"
import { prisma } from "@/lib/prisma"
import { readDetails, readPacks, STARTER_KINDS, type DetailDef, type KindDef, type PackDef } from "@/domain/product-kinds"

/** Farm For You's product kinds (Admin → Products), read defensively. `all` includes retired ones (admin). */
export async function listKinds(all = false) {
  const rows = await prisma.productKind.findMany({ where: all ? {} : { retired: false }, orderBy: [{ module: "asc" }, { sortOrder: "asc" }, { nameEn: "asc" }] })
  return rows.map((k) => ({ ...k, packs: readPacks(k.packs), details: readDetails(k.details) }))
}

export type Kind = Awaited<ReturnType<typeof listKinds>>[number]

export type KindInput = Omit<KindDef, "key"> & { key?: string }

/** Adds or changes a kind. A new kind's key comes from its English name (unique). */
export async function saveKind(id: string | null, k: KindInput) {
  const data = {
    module: k.module,
    nameTa: k.nameTa,
    nameEn: k.nameEn,
    art: k.art,
    measure: k.measure,
    packs: k.packs as PackDef[],
    details: k.details as DetailDef[],
    weighedOnDelivery: k.weighedOnDelivery,
    shelfLifeDays: k.shelfLifeDays,
    hsn: k.hsn,
    gstRate: k.gstRate,
  }
  if (id) return prisma.productKind.update({ where: { id }, data })
  const base = (k.key ?? k.nameEn).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "kind"
  const taken = new Set((await prisma.productKind.findMany({ select: { key: true } })).map((r) => r.key))
  let key = base
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`
  const count = await prisma.productKind.count()
  return prisma.productKind.create({ data: { ...data, key, sortOrder: count } })
}

/** Loads the starter list: kinds not there yet (by key) are added; ones admin already has are left as they are. */
export async function addStarterKinds() {
  const have = new Set((await prisma.productKind.findMany({ select: { key: true } })).map((r) => r.key))
  const missing = STARTER_KINDS.filter((k) => !have.has(k.key))
  if (missing.length)
    await prisma.productKind.createMany({
      data: missing.map((k, i) => ({ ...k, packs: k.packs, details: k.details, sortOrder: have.size + i })),
    })
  return missing.length
}

export async function retireKind(id: string, retired: boolean) {
  await prisma.productKind.update({ where: { id }, data: { retired } })
}
