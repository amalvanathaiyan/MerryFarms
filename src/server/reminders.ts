import "server-only"
import { prisma } from "@/lib/prisma"
import { featuresOf } from "@/lib/features"
import { tenantDb } from "@/lib/tenant-db"
import { addDays, istDate } from "@/domain/ist"
import { batchesNotEntered, farmAlerts, type Alert } from "@/domain/alerts"
import { staffFarmJobsNote, staffNotEnteredNote, staffVaccinesDueNote, staffWarningsNote } from "@/domain/notifications"
import type { FarmReminder } from "@/domain/tasks"
import type { PondReminder } from "@/domain/fish"
import { fishRemindersFor } from "./fish"
import { remindersFor } from "./tasks"
import { batchBook } from "./batches"
import { notifyStaff, notifyStaffMembers } from "./notify"

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

/** A farm reminder in both languages, for a phone notification. */
export function reminderLine(r: FarmReminder): string {
  return r.kind === "service" ? `${r.name}: சர்வீஸ் / service` : `${r.name}: குறைவு / low`
}

/** A pond reminder in both languages: water out of range, or a size check due. */
export function pondLine(r: PondReminder): string {
  return r.kind === "water" ? `${r.pond}: தண்ணீர் சரியில்லை / water needs attention` : `${r.pond}: அளவுச் சோதனை / size check due`
}

/**
 * Morning (about 7 am), every farm with notifications on: the owner and managers get the jobs due today or late that
 * are theirs, machines due for a service and the store running low; anyone a job is for gets their own jobs.
 */
export async function farmJobReminders(now = new Date()) {
  const today = istDate(now)
  const out: { slug: string; jobs: number; reminders: number }[] = []
  const tenants = await prisma.tenant.findMany({ where: { status: { not: "suspended" } } })
  for (const t of tenants) {
    const f = featuresOf(t)
    if (!f.pushNotifications) continue
    try {
      out.push(await farmJobsFor(t, f.poultryCare, f.fishCare, today))
    } catch (e) {
      console.error("[farm jobs]", t.slug, (e as Error).message)
    }
  }
  return out
}

async function farmJobsFor(t: { id: string; slug: string }, poultry: boolean, fish: boolean, today: string) {
  const db = tenantDb(t.id)
  const due = await db.farmTask.findMany({ where: { doneOn: null, dueOn: { lte: today } }, orderBy: { dueOn: "asc" } })
  const feedWarned = poultry && (await alertsFor(t.id, today)).some((a) => a.kind === "feed")
  const reminders = await remindersFor(db, today, feedWarned)
  const ponds = fish ? await fishRemindersFor(db, today) : []
  const late = (x: { dueOn: string; title: string }) => (x.dueOn < today ? `${x.title} (தாமதம் / late)` : x.title)
  const bossLines = [...ponds.filter((p) => p.kind === "water").map(pondLine), ...due.filter((x) => !x.forStaffId).map(late), ...reminders.map(reminderLine), ...ponds.filter((p) => p.kind === "sample").map(pondLine)]
  if (bossLines.length) await notifyStaff(t.id, staffFarmJobsNote(bossLines), ["owner"])
  for (const staffId of new Set(due.map((x) => x.forStaffId).filter((x): x is string => !!x))) {
    await notifyStaffMembers(t.id, [staffId], staffFarmJobsNote(due.filter((x) => x.forStaffId === staffId).map(late)))
  }
  return { slug: t.slug, jobs: due.length, reminders: reminders.length + ponds.length }
}
