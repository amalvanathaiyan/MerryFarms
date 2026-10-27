/**
 * Sets up Merry Farms: farm profile, call rules, categories, products and delivery slots.
 * Safe to re-run: it only creates what is missing.
 *
 *   npm run db:seed            catalogue and slots only (use this for the real shop)
 *   npm run db:seed -- --demo  also adds demo staff (for demo sign-in), 5 sample customers and orders
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { slotRangeLabel } from "../src/domain/slots"

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL })) })
const demo = process.argv.includes("--demo")

const CATEGORIES = [
  { key: "eggs", nameTa: "முட்டை", nameEn: "Eggs", kind: "egg" },
  { key: "chicken", nameTa: "நாட்டுக் கோழி", nameEn: "Country chicken", kind: "chicken" },
]

// Prices are placeholders: set real ones in the farm app (Products).
const PRODUCTS = [
  { cat: "eggs", nameTa: "நாட்டுக் கோழி முட்டை", nameEn: "Country eggs", packTa: "12 முட்டை", packEn: "12 eggs", noteTa: "இன்று காலை இட்டது", noteEn: "Laid this morning", price: 16800, stock: 24, unit: "packs", hsn: "0407" },
  { cat: "eggs", nameTa: "நாட்டுக் கோழி முட்டை", nameEn: "Country eggs", packTa: "30 முட்டை (தட்டு)", packEn: "Tray of 30", noteTa: "குடும்பத்துக்கு ஏற்றது", noteEn: "Best value for families", price: 39000, stock: 14, unit: "trays", hsn: "0407" },
  { cat: "chicken", nameTa: "நாட்டுக் கோழி, கறி வெட்டு", nameEn: "Naatu kozhi, curry cut", packTa: "1 கிலோ", packEn: "1 kg", noteTa: "டெலிவரி நாளில் சுத்தம் செய்து வெட்டப்படும்", noteEn: "Cleaned and cut on delivery day", price: 68000, stock: 12, unit: "kg", hsn: "0207" },
  { cat: "chicken", nameTa: "நாட்டுக் கோழி, முழு", nameEn: "Naatu kozhi, whole", packTa: "ஒரு கோழி, சுமார் 1.2 கிலோ", packEn: "One bird, about 1.2 kg", noteTa: "மேய்ச்சல் கோழி", noteEn: "Free-range", price: 78000, stock: 4, unit: "birds", hsn: "0207" },
]

const SLOTS = [
  { nameTa: "காலை", nameEn: "Morning", startTime: "07:00", endTime: "09:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], cutoffHours: 12, maxOrders: 20 },
  { nameTa: "மாலை", nameEn: "Evening", startTime: "17:00", endTime: "19:00", daysOfWeek: [1, 2, 3, 4, 5, 6], cutoffHours: 6, maxOrders: 15 },
]

async function main() {
  const slug = process.env.DEFAULT_TENANT_SLUG ?? "merryfarms"
  const phone = process.env.SEED_FARM_PHONE ?? "+919626043372"

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      nameTa: "மெர்ரி ஃபார்ம்ஸ்",
      nameEn: "Merry Farms",
      status: "active",
      // The platform owner's own farm: every feature available.
      plan: "pro",
      phone,
      whatsappNumber: phone,
      whatsappMode: "lite",
      invoicePrefix: "MF",
      settings: { create: {} },
    },
  })
  console.log(`Farm: ${tenant.nameEn} (${tenant.slug})`)

  const catIds: Record<string, string> = {}
  for (const [i, c] of CATEGORIES.entries()) {
    const found = await prisma.category.findFirst({ where: { tenantId: tenant.id, nameEn: c.nameEn } })
    const row = found ?? (await prisma.category.create({ data: { tenantId: tenant.id, nameTa: c.nameTa, nameEn: c.nameEn, kind: c.kind, sortOrder: i } }))
    catIds[c.key] = row.id
  }

  for (const [i, p] of PRODUCTS.entries()) {
    const exists = await prisma.product.findFirst({ where: { tenantId: tenant.id, nameEn: p.nameEn, packEn: p.packEn } })
    if (exists) continue
    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catIds[p.cat],
        nameTa: p.nameTa,
        nameEn: p.nameEn,
        packTa: p.packTa,
        packEn: p.packEn,
        noteTa: p.noteTa,
        noteEn: p.noteEn,
        pricePaise: p.price,
        stockQty: p.stock,
        stockUnit: p.unit,
        hsn: p.hsn,
        gstRate: 0,
        sortOrder: i,
      },
    })
  }
  console.log(`Products: ${await prisma.product.count({ where: { tenantId: tenant.id } })}`)

  if ((await prisma.deliverySlot.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.deliverySlot.createMany({ data: SLOTS.map((s) => ({ ...s, tenantId: tenant.id })) })
  }
  console.log(`Delivery slots: ${await prisma.deliverySlot.count({ where: { tenantId: tenant.id } })}`)

  if (demo) {
    // Demo farm details so invoices and UPI links have something to show.
    // Sample delivery area (near Tambaram, 10 km) so the area check can be tried. Change it in Settings.
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { upiId: tenant.upiId ?? "merryfarms@okaxis", fssaiNo: tenant.fssaiNo ?? "12345678901234", farmLat: 12.95, farmLng: 80.14, deliveryRadiusKm: 10, servedPincodes: ["600048"] },
    })

    // Demo staff: signed in with the demo buttons on /login (npm run demo only).
    const staff = [
      { authUserId: "demo-owner", name: "உரிமையாளர் · Owner (demo)", roles: ["owner"] as const },
      { authUserId: "demo-desk", name: "ஆர்டர் மேசை · Order desk (demo)", roles: ["order_desk", "packing"] as const },
      { authUserId: "demo-delivery", name: "டெலிவரி · Delivery (demo)", roles: ["delivery"] as const },
    ]
    for (const st of staff) {
      await prisma.staffMember.upsert({
        where: { tenantId_authUserId: { tenantId: tenant.id, authUserId: st.authUserId } },
        update: {},
        create: { tenantId: tenant.id, authUserId: st.authUserId, name: st.name, roles: [...st.roles] },
      })
    }

    type Sample = {
      phone: string
      name: string
      line: string
      landmark: string | null
      status: "to_confirm" | "confirmed" | "out_for_delivery"
      channel: "whatsapp" | "web"
      items: [number, number][] // [product index, qty]
    }
    const samples: Sample[] = [
      { phone: "+919000010001", name: "பிரியா (Sample)", line: "12, ஏரிக்கரை சாலை", landmark: "கோவில் அருகில்", status: "to_confirm", channel: "whatsapp", items: [[1, 2]] },
      { phone: "+919000010002", name: "கார்த்திக் (Sample)", line: "4/2, கோவில் தெரு", landmark: "பால் பூத் எதிரில்", status: "to_confirm", channel: "web", items: [[0, 1], [2, 1]] },
      { phone: "+919000010003", name: "Meena (Sample)", line: "7, Gandhi Nagar 2nd Cross", landmark: null, status: "confirmed", channel: "web", items: [[3, 1]] },
      { phone: "+919000010004", name: "அருண் (Sample)", line: "21, சந்தை சாலை", landmark: null, status: "out_for_delivery", channel: "whatsapp", items: [[1, 1]] },
      { phone: "+919000010005", name: "Fathima (Sample)", line: "9, Station Road", landmark: "Near bus stand", status: "out_for_delivery", channel: "web", items: [[0, 2]] },
    ]
    const products = await prisma.product.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } })
    const slot = await prisma.deliverySlot.findFirst({ where: { tenantId: tenant.id }, orderBy: { startTime: "asc" } })
    const tomorrow = new Date(Date.now() + 330 * 60_000 + 86_400_000).toISOString().slice(0, 10)
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
    let number = ((await prisma.order.aggregate({ where: { tenantId: tenant.id }, _max: { number: true } }))._max.number ?? 1000) + 1
    for (const s of samples) {
      const customer = await prisma.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: s.phone } },
        update: {},
        create: { tenantId: tenant.id, phone: s.phone, name: s.name, language: /[a-z]/i.test(s.name[0]) ? "en" : "ta", notes: "Demo data — delete before going live" },
      })
      const address = await prisma.address.create({ data: { tenantId: tenant.id, customerId: customer.id, line: s.line, landmark: s.landmark, pincode: "600126" } })
      const lines = s.items.map(([i, qty]) => ({ p: products[i], qty }))
      const subtotal = lines.reduce((a, l) => a + l.p.pricePaise * l.qty, 0)
      const fee = subtotal >= tenant.freeAbovePaise ? 0 : tenant.deliveryFeePaise
      const onTheWay = s.status === "out_for_delivery"
      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          number: number++,
          customerId: customer.id,
          addressId: address.id,
          channel: s.channel,
          status: s.status,
          needsCall: s.status === "to_confirm",
          slotId: slot?.id,
          slotDate: onTheWay ? today : tomorrow,
          slotLabel: slot ? slotRangeLabel(slot.startTime, slot.endTime) : "7–9 AM",
          paymentMethod: "upi_on_delivery",
          subtotalPaise: subtotal,
          deliveryFeePaise: fee,
          totalPaise: subtotal + fee,
          note: "Demo order",
          items: { create: lines.map((l) => ({ tenantId: tenant.id, productId: l.p.id, qty: l.qty, unitPricePaise: l.p.pricePaise, gstRate: l.p.gstRate })) },
          events: { create: { tenantId: tenant.id, toStatus: s.status, note: "demo" } },
        },
      })
    }
    console.log("Demo customers and orders added (marked as Sample / Demo).")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
