import "server-only"
import { prisma } from "@/lib/prisma"
import { featuresOf } from "@/lib/features"
import { farmLogoUrl } from "@/lib/farm-url"
import { istDate } from "@/domain/ist"
import { currentPrice } from "@/domain/offers"
import { artFor } from "@/domain/product-art"
import { matchesProduct, rankFarms, reachOf, type Reach } from "@/domain/directory"
import { isPincode, type LatLng } from "@/domain/delivery-area"
import { areaOf } from "./orders"
import { loadSettings } from "./settings"
import { pincodeCentre } from "./geo"

/**
 * Farm For You's farm directory (farmforyou.in/farms): farms customers can find by where they live and what they
 * want. A farm is listed when it isn't suspended, its web shop is on, and its "Show on Farm For You" choice is on
 * (Settings → Choices; on unless the farm turns it off). Only what each shop already shows publicly is used.
 */

const FARM_FIELDS = {
  id: true,
  slug: true,
  nameTa: true,
  nameEn: true,
  status: true,
  plan: true,
  features: true,
  entitlements: true,
  logoUrl: true,
  invoicePrefix: true,
  taglineTa: true,
  taglineEn: true,
  nameColours: true,
  storyTa: true,
  storyEn: true,
  phone: true,
  whatsappNumber: true,
  farmLat: true,
  farmLng: true,
  deliveryRadiusKm: true,
  servedPincodes: true,
  trialEndsAt: true,
} as const

async function listed(where: { slug?: string } = {}) {
  const farms = await prisma.tenant.findMany({ where: { status: { not: "suspended" }, ...where }, select: FARM_FIELDS, orderBy: { createdAt: "asc" } })
  const shown = await Promise.all(
    farms.map(async (f) => featuresOf(f).webShop && (await loadSettings(f.id)).listedOnFfy.value === true)
  )
  return farms.filter((_, i) => shown[i])
}

type Farm = Awaited<ReturnType<typeof listed>>[number]

/** Products a farm shows in its shop, priced as today (offers included). Photos carry the farm, since this page isn't on the farm's address. */
async function shopProducts(tenantIds: string[]) {
  if (!tenantIds.length) return []
  const today = istDate(new Date())
  const rows = await prisma.product.findMany({
    where: { tenantId: { in: tenantIds }, isActive: true, onWeb: true, deletedAt: null },
    include: { category: { select: { nameTa: true, nameEn: true, kind: true } }, tenant: { select: { slug: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  return rows.map((p) => ({
    id: p.id,
    tenantId: p.tenantId,
    nameTa: p.nameTa,
    nameEn: p.nameEn,
    packTa: p.packTa,
    packEn: p.packEn,
    pricePaise: currentPrice(p, today),
    imageUrl: p.imageUrl ? `${p.imageUrl}${p.imageUrl.includes("?") ? "&" : "?"}farm=${p.tenant.slug}` : null,
    art: artFor(p.category?.kind, p.nameEn, p.nameTa, p.category?.nameEn, p.category?.nameTa),
    words: [p.nameTa, p.nameEn, p.packTa, p.packEn, p.category?.nameTa, p.category?.nameEn],
  }))
}

export type DirectoryProduct = Awaited<ReturnType<typeof shopProducts>>[number]

const card = (f: Farm) => ({
  slug: f.slug,
  nameTa: f.nameTa,
  nameEn: f.nameEn,
  logoUrl: farmLogoUrl(f.slug, f.logoUrl),
  invoicePrefix: f.invoicePrefix,
  taglineTa: f.taglineTa,
  taglineEn: f.taglineEn,
  nameColours: f.nameColours,
})

export interface DirectoryQuery {
  pincode?: string | null
  location?: LatLng | null
  /** What they want: words matched against product and category names. */
  q?: string | null
}

/**
 * Listed farms for a search: those that deliver there first (nearest first), then those to ask; a product search
 * keeps only farms with a matching product, and shows those products.
 */
export async function searchDirectory(query: DirectoryQuery) {
  const farms = await listed()
  const products = await shopProducts(farms.map((f) => f.id))
  const pincode = query.pincode && isPincode(query.pincode) ? query.pincode.trim() : null
  const q = query.q?.trim() || null
  // A PIN on a farm that serves by distance: one lookup of the PIN's centre for the whole search.
  const needsCentre = !!pincode && !query.location && farms.some((f) => f.farmLat != null && f.deliveryRadiusKm)
  const pinCentre = needsCentre ? await pincodeCentre(pincode!).catch(() => null) : null
  const searched = !!pincode || !!query.location

  const results = farms
    .map((f) => {
      const own = products.filter((p) => p.tenantId === f.id)
      const matching = q ? own.filter((p) => matchesProduct(q, p.words)) : own
      const reach: Reach = searched ? reachOf(areaOf(f), { location: query.location, pincode, pinCentre }) : { reach: "ask", distanceKm: null, approx: false }
      return { ...card(f), name: f.nameEn, reach, products: matching.slice(0, 4), more: Math.max(0, matching.length - 4), matched: matching.length }
    })
    .filter((r) => !q || r.matched > 0)
  return { searched, results: searched ? rankFarms(results) : results }
}

/** One listed farm's page: its story, what it sells, where it delivers, how to reach it. Null if not listed. */
export async function farmProfile(slug: string) {
  const [f] = await listed({ slug })
  if (!f) return null
  const [products, videos] = await Promise.all([
    shopProducts([f.id]),
    featuresOf(f).farmVideos
      ? prisma.farmVideo.findMany({ where: { tenantId: f.id, kind: "youtube" }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], take: 3 })
      : Promise.resolve([]),
  ])
  return {
    ...card(f),
    storyTa: f.storyTa,
    storyEn: f.storyEn,
    phone: f.phone,
    whatsappNumber: f.whatsappNumber ?? f.phone,
    area: { radiusKm: f.farmLat != null && f.farmLng != null ? f.deliveryRadiusKm : null, pincodes: f.servedPincodes },
    products,
    videos: videos.map((v) => ({ id: v.id, src: v.src, title: v.title })),
  }
}

/** Listed farms for the home page's "Farms on Farm For You". */
export async function listedFarmCards(take = 12) {
  return (await listed()).slice(0, take).map(card)
}
