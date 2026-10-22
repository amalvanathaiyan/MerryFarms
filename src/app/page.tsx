import { getLocale, getTranslations } from "next-intl/server"
import { getTenant } from "@/lib/tenant"
import { tenantDb } from "@/lib/tenant-db"
import { dayLabel, istTime, pick } from "@/lib/i18n-helpers"
import { slotRangeLabel } from "@/domain/slots"
import { addDays, istDate } from "@/domain/ist"
import { openSlotOptions } from "@/server/orders"
import { Shop, type ShopData } from "@/components/shop/shop"
import { featuresOf } from "@/lib/features"
import { getSessionCustomer } from "@/lib/customer-session"
import { artKind } from "@/domain/product-art"
import { otpOn } from "@/server/otp"
import { SignInGate } from "@/components/shop/sign-in-gate"
import { currentPrice, offerActive, percentOff } from "@/domain/offers"

export const dynamic = "force-dynamic"

/** The farm's customer shop: Tamil first, works without login. */
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ reorder?: string; browse?: string }> }) {
  const { reorder, browse } = await searchParams
  const tenant = await getTenant()
  if (!tenant) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">FarmForYou</h1>
        <p className="mt-2 text-muted-foreground">No farm is set up at this address.</p>
      </main>
    )
  }

  // Code sign-in: ask for the mobile number first; "just look" is one tap away.
  if (otpOn(tenant) && browse === undefined && !reorder && !(await getSessionCustomer())) {
    return <SignInGate tenant={tenant} />
  }

  const locale = await getLocale()
  const t = await getTranslations("common")
  const db = tenantDb(tenant.id)
  const [categories, products, options] = await Promise.all([
    db.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({
      where: { isActive: true, onWeb: true, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    openSlotOptions(tenant.id),
  ])

  const labels = { today: t("today"), tomorrow: t("tomorrow") }
  const features = featuresOf(tenant)
  // A returning customer on this phone: pre-fill checkout, and "Order again" from My orders.
  const me = await getSessionCustomer()
  const again = me && reorder ? await db.order.findFirst({ where: { id: reorder, customerId: me.id }, include: { items: true } }) : null
  const latest = me?.addresses[0]
  const firstOpen = options.find((o) => !o.full)

  const data: ShopData = {
    farm: {
      name: pick(locale, tenant.nameTa, tenant.nameEn),
      phone: tenant.phone,
      whatsappNumber: tenant.whatsappNumber ?? tenant.phone,
      orderPrefix: tenant.invoicePrefix,
      deliveryFeePaise: tenant.deliveryFeePaise,
      freeAbovePaise: tenant.freeAbovePaise,
      paused: tenant.status === "suspended",
      webOrdering: features.webShop,
      tracksStock: features.stockTracking,
      // Only the radius is shown; the farm's exact location stays on the server.
      radiusKm: features.deliveryArea ? tenant.deliveryRadiusKm : null,
      accounts: features.customerAccounts,
      push: features.pushNotifications,
      otp: otpOn(tenant),
      messages: features.messages,
    },
    me: me
      ? {
          name: me.name,
          phone: me.phone,
          address: latest ? { line: latest.line, landmark: latest.landmark ?? "", pincode: latest.pincode ?? "", lat: latest.lat, lng: latest.lng } : null,
        }
      : null,
    // Only items still on sale, never more than in stock.
    initialCart: again
      ? Object.fromEntries(
          again.items
            .map((i) => [i.productId, Math.min(i.qty, features.stockTracking ? (products.find((p) => p.id === i.productId)?.stockQty ?? 0) : i.qty)] as const)
            .filter(([id, q]) => q > 0 && products.some((p) => p.id === id))
        )
      : null,
    categories: categories
      .filter((c) => products.some((p) => p.categoryId === c.id))
      .map((c) => ({ id: c.id, name: pick(locale, c.nameTa, c.nameEn) })),
    products: products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      name: pick(locale, p.nameTa, p.nameEn),
      pack: pick(locale, p.packTa, p.packEn),
      note: pick(locale, p.noteTa, p.noteEn),
      pricePaise: currentPrice(p, istDate(new Date())),
      listPricePaise: offerActive(p, istDate(new Date())) ? p.pricePaise : null,
      offerPct: offerActive(p, istDate(new Date())) ? percentOff(p) : 0,
      offerEnds: offerActive(p, istDate(new Date())) && p.offerEndsOn ? dayLabel(p.offerEndsOn, locale, labels) : null,
      stockQty: p.stockQty,
      imageUrl: p.imageUrl,
      art: artKind(p.nameEn, p.nameTa, ...categories.filter((c) => c.id === p.categoryId).flatMap((c) => [c.nameEn, c.nameTa])),
    })),
    slots: options.map((o) => ({
      key: o.key,
      label: `${dayLabel(o.date, locale, labels)} · ${slotRangeLabel(o.slot.startTime, o.slot.endTime)}`,
      full: o.full,
      left: o.left,
    })),
    closures: (await db.closedDay.findMany({ where: { date: { gte: istDate(new Date()), lte: addDays(istDate(new Date()), 7) }, slotId: null }, orderBy: { date: "asc" } })).map(
      (c) => `${dayLabel(c.date, locale, labels)}${c.note ? ` (${c.note})` : ""}`
    ),
    nextDelivery: firstOpen
      ? {
          label: `${dayLabel(firstOpen.date, locale, labels)} · ${slotRangeLabel(firstOpen.slot.startTime, firstOpen.slot.endTime)}`,
          orderBy: `${dayLabel(istDate(firstOpen.cutoffAt), locale, labels)} ${istTime(firstOpen.cutoffAt, locale)}`,
        }
      : null,
  }

  return <Shop data={data} />
}
