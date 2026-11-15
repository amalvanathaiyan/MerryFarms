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

/** Starter kinds from earlier lists that were split or renamed (dressed_poultry, paneer + butter, meat). */
const OLD_STARTER_KEYS = ["dressed_chicken", "paneer_butter", "mutton"]

const untouched = (k: { createdAt: Date; updatedAt: Date }) => k.updatedAt.getTime() === k.createdAt.getTime()
const starterData = (k: KindDef) => ({ module: k.module, nameTa: k.nameTa, nameEn: k.nameEn, art: k.art, measure: k.measure, packs: k.packs, details: k.details, weighedOnDelivery: k.weighedOnDelivery, shelfLifeDays: k.shelfLifeDays, hsn: k.hsn, gstRate: k.gstRate })
/** Same value, whatever the order of keys (Postgres JSONB stores object keys in its own order). */
const stable = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, stable(x)])) : v
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a ?? null)) === JSON.stringify(stable(b ?? null))

/**
 * What loading the starter list would do now: kinds to add, kinds admin never edited that the latest list changes,
 * and old starter kinds (renamed since) that are unedited and unused, to remove. Admin's own edits are never touched.
 */
export async function starterChanges() {
  const [rows, used] = await Promise.all([
    prisma.productKind.findMany(),
    prisma.category.findMany({ where: { productKindId: { not: null } }, select: { productKindId: true }, distinct: ["productKindId"] }),
  ])
  const usedIds = new Set(used.map((u) => u.productKindId))
  const byKey = new Map(rows.map((r) => [r.key, r]))
  const add = STARTER_KINDS.filter((k) => !byKey.has(k.key))
  const update = STARTER_KINDS.filter((k) => {
    const r = byKey.get(k.key)
    if (!r || !untouched(r)) return false
    return Object.entries(starterData(k)).some(([field, value]) => !same(value, (r as Record<string, unknown>)[field]))
  })
  const remove = rows.filter((r) => OLD_STARTER_KEYS.includes(r.key) && untouched(r) && !usedIds.has(r.id))
  return { add, update, remove, count: add.length + update.length + remove.length }
}

/** Loads (or brings up to date) the starter list, as starterChanges says. Returns how many kinds changed. */
export async function addStarterKinds() {
  const { add, update, remove } = await starterChanges()
  const count = await prisma.productKind.count()
  await prisma.$transaction(async (tx) => {
    if (add.length) await tx.productKind.createMany({ data: add.map((k, i) => ({ key: k.key, ...starterData(k), sortOrder: count + i })) })
    for (const k of update) {
      const r = await tx.productKind.findUniqueOrThrow({ where: { key: k.key }, select: { createdAt: true } })
      // Still "never edited by admin" afterwards, so a later list can update it again.
      await tx.productKind.update({ where: { key: k.key }, data: { ...starterData(k), updatedAt: r.createdAt } })
    }
    if (remove.length) await tx.productKind.deleteMany({ where: { id: { in: remove.map((r) => r.id) } } })
  })
  return add.length + update.length + remove.length
}

export async function retireKind(id: string, retired: boolean) {
  await prisma.productKind.update({ where: { id }, data: { retired } })
}
