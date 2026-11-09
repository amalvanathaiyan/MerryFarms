import "server-only"
import { prisma } from "@/lib/prisma"
import { featuresOf } from "@/lib/features"
import { tenantDb } from "@/lib/tenant-db"
import { addDays, istDate } from "@/domain/ist"
import { batchesNotEntered, farmAlerts, type Alert } from "@/domain/alerts"
import { staffNotEnteredNote, staffVaccinesDueNote, staffWarningsNote } from "@/domain/notifications"
import { batchBook } from "./batches"
import { notifyStaff } from "./notify"

/** Owner and packing staff keep the batches, so they get the poultry reminders. */
const KEEPERS = ["owner", "packing"] as const

/** The warnings for one farm today (unusual losses, feed running out, eggs dropping). */
export async function alertsFor(tenantId: string, today: string): Promise<Alert[]> {
  const book = await batchBook(tenantId, today)
  return farmAlerts(
    book.rows.map((r) => r.info),
    book.days,
    book.losses,
    book.feed,
    today
  )
}

/** One warning in both languages, for a phone notification. */
export function alertLine(a: Alert): { ta: string; en: string } {
  switch (a.kind) {
    case "losses":
      return { ta: `${a.batchName}: ${a.lost} இழப்பு`, en: `${a.batchName}: ${a.lost} lost` }
    case "feed":
      return a.daysLeft === 0 ? { ta: "தீவனம் தீர்ந்தது", en: "feed has run out" } : { ta: `தீவனம் ${a.daysLeft} நாள்`, en: `feed for ${a.daysLeft} days` }
    case "laying":
      return { ta: `${a.batchName}: முட்டை ${a.before}%→${a.now}%`, en: `${a.batchName}: eggs ${a.before}%→${a.now}%` }
  }
}

async function poultryFarms() {
  const tenants = await prisma.tenant.findMany({ where: { status: { not: "suspended" } } })
  return tenants.filter((t) => {
    const f = featuresOf(t)
    return f.poultryCare && f.pushNotifications
  })
}

/** Evening (about 6 pm): remind the keepers of batches with nothing entered for today. */
export async function eveningReminders(now = new Date()) {
  const today = istDate(now)
  const out: { slug: string; notEntered: number }[] = []
  for (const t of await poultryFarms()) {
    const book = await batchBook(t.id, today)
    const missing = batchesNotEntered(
      book.rows.map((r) => r.info),
      book.days,
      book.losses,
      today
    )
    if (missing.length) await notifyStaff(t.id, staffNotEnteredNote(missing.map((b) => b.name)), [...KEEPERS])
    out.push({ slug: t.slug, notEntered: missing.length })
  }
  return out
}

/** Morning (about 7 am): vaccines due today or late, and any warnings from yesterday's entries. */
export async function morningReminders(now = new Date()) {
  const today = istDate(now)
  const out: { slug: string; vaccines: number; warnings: number }[] = []
  for (const t of await poultryFarms()) {
    const doses = await tenantDb(t.id).batchVaccination.findMany({
      where: { givenDate: null, dueDate: { lte: today }, batch: { startDate: { lte: today }, OR: [{ closedDate: null }, { closedDate: { gte: today } }] } },
      include: { batch: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    })
    if (doses.length) {
      await notifyStaff(t.id, staffVaccinesDueNote(doses.map((d) => ({ vaccine: d.vaccine, batchName: d.batch.name, late: d.dueDate! < today }))), [...KEEPERS])
    }
    // In the morning nothing is entered for today yet, so losses are looked at for yesterday.
    const warnings = (await alertsFor(t.id, today)).filter((a) => a.kind !== "losses" || a.date === addDays(today, -1))
    if (warnings.length) await notifyStaff(t.id, staffWarningsNote(warnings.map(alertLine)), [...KEEPERS])
    out.push({ slug: t.slug, vaccines: doses.length, warnings: warnings.length })
  }
  return out
}
