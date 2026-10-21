/**
 * Sets up Merry Farms: farm profile, call rules, categories, products and delivery slots.
 * Safe to re-run: it only creates what is missing.
 *
 *   npm run db:seed            catalogue and slots only (use this for the real shop)
 *   npm run db:seed -- --demo  also adds 3 clearly marked sample customers and orders
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
  { key: "eggs", nameTa: "முட்டை", nameEn: "Eggs" },
  { key: "chicken", nameTa: "நாட்டுக் கோழி", nameEn: "Country chicken" },
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
  const phone = process.env.SEED_FARM_PHONE ?? "+919000020001"

  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      nameTa: "மெர்ரி ஃபார்ம்ஸ்",
      nameEn: "Merry Farms",
      status: "active",
      plan: "free",
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
    const row = found ?? (await prisma.category.create({ data: { tenantId: tenant.id, nameTa: c.nameTa, nameEn: c.nameEn, sortOrder: i } }))
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
    const samples = [
      { phone: "+919000010001", name: "மாதிரி வாடிக்கையாளர் 1 (Sample)" },
      { phone: "+919000010002", name: "மாதிரி வாடிக்கையாளர் 2 (Sample)" },
      { phone: "+919000010003", name: "Sample customer 3" },
    ]
    const products = await prisma.product.findMany({ where: { tenantId: tenant.id }, orderBy: { sortOrder: "asc" } })
    const slot = await prisma.deliverySlot.findFirst({ where: { tenantId: tenant.id }, orderBy: { startTime: "asc" } })
    const tomorrow = new Date(Date.now() + 330 * 60_000 + 86_400_000).toISOString().slice(0, 10)
    let number = ((await prisma.order.aggregate({ where: { tenantId: tenant.id }, _max: { number: true } }))._max.number ?? 1000) + 1
    for (const [i, s] of samples.entries()) {
      const customer = await prisma.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: s.phone } },
        update: {},
        create: { tenantId: tenant.id, phone: s.phone, name: s.name, notes: "Demo data — delete before going live" },
      })
      const p = products[i % products.length]
      await prisma.order.create({
        data: {
          tenantId: tenant.id,
          number: number++,
          customerId: customer.id,
          channel: i === 0 ? "whatsapp" : "web",
          status: i === 2 ? "confirmed" : "to_confirm",
          slotId: slot?.id,
          slotDate: tomorrow,
          slotLabel: slot ? slotRangeLabel(slot.startTime, slot.endTime) : "7–9 AM",
          paymentMethod: "upi_on_delivery",
          subtotalPaise: p.pricePaise,
          deliveryFeePaise: p.pricePaise >= 50000 ? 0 : 3000,
          totalPaise: p.pricePaise + (p.pricePaise >= 50000 ? 0 : 3000),
          note: "Demo order",
          items: { create: { tenantId: tenant.id, productId: p.id, qty: 1, unitPricePaise: p.pricePaise, gstRate: 0 } },
          events: { create: { tenantId: tenant.id, toStatus: i === 2 ? "confirmed" : "to_confirm", note: "demo" } },
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
