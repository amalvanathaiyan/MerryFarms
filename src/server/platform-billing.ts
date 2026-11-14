import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { addDays, istDate } from "@/domain/ist"
import { cleanLines, cleanProfile, invoiceAmounts, invoiceNumber, invoiceNumberPrefix, isPaidUp, type BillingProfile, type InvoiceLine } from "@/domain/platform-billing"
import { OrderError } from "./orders"
import { emitEvent } from "./events"
import { audit, type Actor } from "./audit"
import { moduleSettings } from "./subscriptions"

/**
 * Farm For You's invoices and payments to farms (docs/platform-plan.md §3.5), its billing details and GST switch,
 * and announcements to farms. Every change is in the audit log. Rules are in src/domain/platform-billing.ts.
 */

const PROFILE_KEY = "billing.profile"

export async function billingProfile(): Promise<BillingProfile> {
  const row = await prisma.settingValue.findUnique({ where: { scopeKey_key: { scopeKey: "platform", key: PROFILE_KEY } } })
  return cleanProfile(row?.value)
}

export async function saveBillingProfile(raw: unknown, actor: Actor) {
  const before = await billingProfile()
  const next = cleanProfile(raw)
  if ((raw as { gstOn?: unknown })?.gstOn === true && !next.gstOn) throw new OrderError("gstin_needed")
  const value = next as unknown as Prisma.InputJsonValue
  await prisma.settingValue.upsert({
    where: { scopeKey_key: { scopeKey: "platform", key: PROFILE_KEY } },
    create: { scopeKey: "platform", tenantId: null, key: PROFILE_KEY, value },
    update: { value },
  })
  await audit(actor, [{ tenantId: null, action: before.gstOn !== next.gstOn ? "billing.gst_switched" : "billing.profile", subject: PROFILE_KEY, before, after: next }])
}

// ── Invoices ─────────────────────────────────────────────────────────────────

/** What a farm's next invoice is made from: its plan, add-ons with their prices, and the day the period starts. */
export async function invoiceDraftInputs(tenantId: string, now = new Date()) {
  const today = istDate(now)
  const [sub, last, mods] = await Promise.all([
    prisma.farmSubscription.findUnique({ where: { tenantId }, include: { plan: true } }),
    prisma.platformInvoice.findFirst({ where: { tenantId, status: { not: "void" }, periodEnd: { not: null } }, orderBy: { periodEnd: "desc" }, select: { periodEnd: true } }),
    moduleSettings(),
  ])
  // After the last period billed; else when the trial ends (if later); else today
  const trialEnd = sub?.status === "trial" && sub.trialEndsAt ? addDays(istDate(sub.trialEndsAt), 1) : null
  const periodStart = last?.periodEnd ? addDays(last.periodEnd, 1) : trialEnd && trialEnd > today ? trialEnd : today
  return { sub, periodStart, addOnPrices: mods.map((m) => ({ key: m.key, monthlyPaise: m.addOnMonthlyPaise, yearlyPaise: m.addOnYearlyPaise })) }
}

export interface InvoiceInput {
  tenantId: string
  lines: InvoiceLine[]
  periodStart: string | null
  periodEnd: string | null
  dueOn: string | null
  otherState: boolean
  notes: string | null
}

/** Makes an invoice, numbered next in the financial year, with Farm For You's and the farm's details as they are now. */
export async function createInvoice(input: InvoiceInput, actor: Actor, now = new Date()) {
  const lines = cleanLines(input.lines).filter((l) => l.text.trim() && l.amountPaise > 0)
  if (!lines.length) throw new OrderError("invalid_form")
  const [profile, farm] = await Promise.all([billingProfile(), prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { nameTa: true, nameEn: true, phone: true, gstin: true, slug: true } })])
  if (!farm) throw new OrderError("not_found")
  const amounts = invoiceAmounts(lines, profile, { gstin: farm.gstin, otherState: input.otherState })
  const issuedOn = istDate(now)
  const seller = { name: profile.name, address: profile.address, phone: profile.phone, email: profile.email, gstin: profile.gstOn ? profile.gstin : null, sac: profile.gstOn ? profile.sac : null, upiId: profile.upiId, bank: profile.bank }
  const buyer = { nameTa: farm.nameTa, nameEn: farm.nameEn, phone: farm.phone, gstin: farm.gstin, slug: farm.slug }
  const prefix = invoiceNumberPrefix(now)
  for (let attempt = 0; ; attempt++) {
    const seq = (await prisma.platformInvoice.count({ where: { number: { startsWith: prefix } } })) + 1 + attempt
    try {
      const inv = await prisma.platformInvoice.create({
        data: {
          number: invoiceNumber(now, seq),
          tenantId: input.tenantId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          lines: lines.map((l) => ({ text: l.text.trim().slice(0, 120), amountPaise: l.amountPaise })),
          ...amounts,
          issuedOn,
          dueOn: input.dueOn && input.dueOn >= issuedOn ? input.dueOn : addDays(issuedOn, profile.dueDays),
          seller,
          buyer,
          notes: input.notes?.trim().slice(0, 500) || null,
          createdBy: actor.name,
        },
      })
      await audit(actor, [{ tenantId: input.tenantId, action: "billing.invoice_made", subject: inv.number, after: { totalPaise: inv.totalPaise, dueOn: inv.dueOn } }])
      await emitEvent("invoice.created", input.tenantId, { invoiceId: inv.id, number: inv.number, totalPaise: inv.totalPaise })
      return inv
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 5) continue
      throw e
    }
  }
}

/** One invoice with its payments; for a farm, only its own. */
export async function invoiceWithPayments(id: string, tenantId?: string) {
  const inv = await prisma.platformInvoice.findFirst({ where: { id, ...(tenantId ? { tenantId } : {}) }, include: { payments: { orderBy: { paidOn: "asc" } } } })
  if (!inv) return null
  const paidPaise = inv.payments.reduce((a, p) => a + p.amountPaise, 0)
  return { ...inv, lines: cleanLines(inv.lines), paidPaise, leftPaise: Math.max(0, inv.totalPaise - paidPaise) }
}

export interface PaymentInput {
  invoiceId: string
  amountPaise: number
  method: string
  reference: string | null
  paidOn: string
}

/** Records money received against an invoice; the invoice is paid once its payments reach the total. */
export async function recordPayment(input: PaymentInput, actor: Actor) {
  const inv = await invoiceWithPayments(input.invoiceId)
  if (!inv) throw new OrderError("not_found")
  if (inv.status === "void") throw new OrderError("invoice_void")
  if (input.amountPaise <= 0 || input.amountPaise > inv.leftPaise) throw new OrderError("payment_too_much")
  const paidUp = isPaidUp(inv.totalPaise, inv.paidPaise + input.amountPaise)
  await prisma.$transaction([
    prisma.platformPayment.create({ data: { tenantId: inv.tenantId, invoiceId: inv.id, amountPaise: input.amountPaise, method: input.method, reference: input.reference?.trim().slice(0, 80) || null, paidOn: input.paidOn, recordedBy: actor.name } }),
    prisma.platformInvoice.update({ where: { id: inv.id }, data: paidUp ? { status: "paid", paidAt: new Date() } : {} }),
  ])
  await audit(actor, [{ tenantId: inv.tenantId, action: "billing.payment", subject: inv.number, after: { amountPaise: input.amountPaise, method: input.method, reference: input.reference, paidOn: input.paidOn, paidUp } }])
  await emitEvent("invoice.payment", inv.tenantId, { invoiceId: inv.id, amountPaise: input.amountPaise, paidUp })
}

/** Takes back a payment recorded by mistake; the invoice is due again if it no longer reaches the total. */
export async function removePayment(paymentId: string, actor: Actor) {
  const p = await prisma.platformPayment.findUnique({ where: { id: paymentId }, include: { invoice: { select: { id: true, number: true, totalPaise: true, status: true } } } })
  if (!p) throw new OrderError("not_found")
  await prisma.platformPayment.delete({ where: { id: p.id } })
  const left = await prisma.platformPayment.aggregate({ where: { invoiceId: p.invoiceId }, _sum: { amountPaise: true } })
  if (p.invoice.status === "paid" && !isPaidUp(p.invoice.totalPaise, left._sum.amountPaise ?? 0)) await prisma.platformInvoice.update({ where: { id: p.invoiceId }, data: { status: "due", paidAt: null } })
  await audit(actor, [{ tenantId: p.tenantId, action: "billing.payment_removed", subject: p.invoice.number, before: { amountPaise: p.amountPaise, method: p.method, reference: p.reference, paidOn: p.paidOn } }])
}

/** Cancels an invoice made by mistake (its number stays used). Only while nothing has been paid on it. */
export async function voidInvoice(id: string, reason: string, actor: Actor) {
  const inv = await invoiceWithPayments(id)
  if (!inv) throw new OrderError("not_found")
  if (inv.payments.length > 0) throw new OrderError("invoice_has_payments")
  if (inv.status === "void") return
  await prisma.platformInvoice.update({ where: { id }, data: { status: "void", voidReason: reason.trim().slice(0, 200) || null } })
  await audit(actor, [{ tenantId: inv.tenantId, action: "billing.invoice_void", subject: inv.number, after: { reason } }])
}

/** Every invoice for the Billing page, newest first, with what has been paid on each. */
export async function listInvoices() {
  const rows = await prisma.platformInvoice.findMany({
    orderBy: [{ issuedOn: "desc" }, { number: "desc" }],
    take: 500,
    include: { payments: { select: { amountPaise: true } }, tenant: { select: { id: true, nameTa: true, nameEn: true } } },
  })
  return rows.map((r) => {
    const paidPaise = r.payments.reduce((a, p) => a + p.amountPaise, 0)
    return { id: r.id, number: r.number, tenant: r.tenant, totalPaise: r.totalPaise, paidPaise, leftPaise: r.status === "void" ? 0 : Math.max(0, r.totalPaise - paidPaise), status: r.status, issuedOn: r.issuedOn, dueOn: r.dueOn }
  })
}

/** A farm's latest invoices (newest first) and what it still owes on all of them. */
export async function farmInvoices(tenantId: string, take = 24) {
  const include = { payments: { select: { amountPaise: true } } }
  const [rows, unpaid] = await Promise.all([
    prisma.platformInvoice.findMany({ where: { tenantId }, orderBy: [{ issuedOn: "desc" }, { number: "desc" }], take, include }),
    prisma.platformInvoice.findMany({ where: { tenantId, status: "due" }, include }),
  ])
  const left = (r: { status: string; totalPaise: number; payments: { amountPaise: number }[] }) => (r.status === "void" ? 0 : Math.max(0, r.totalPaise - r.payments.reduce((a, p) => a + p.amountPaise, 0)))
  const list = rows.map((r) => ({ id: r.id, number: r.number, totalPaise: r.totalPaise, leftPaise: left(r), status: r.status, issuedOn: r.issuedOn, dueOn: r.dueOn, periodStart: r.periodStart, periodEnd: r.periodEnd }))
  return { invoices: list, owedPaise: unpaid.reduce((a, r) => a + left(r), 0) }
}

/** How many unpaid invoices are past their due date (the dashboard's "needs you"). */
export function overdueCount(now = new Date()) {
  return prisma.platformInvoice.count({ where: { status: "due", dueOn: { lt: istDate(now) } } })
}

// ── Announcements ────────────────────────────────────────────────────────────

export interface AnnouncementInput {
  titleTa: string
  titleEn: string
  bodyTa: string | null
  bodyEn: string | null
  tone: string
  audience: string
  onlyFarms: string[]
  startsOn: string
  endsOn: string | null
}

export async function saveAnnouncement(id: string | null, input: AnnouncementInput, actor: Actor) {
  if (input.endsOn && input.endsOn < input.startsOn) throw new OrderError("ends_before_start")
  const data = { ...input, onlyFarms: [...new Set(input.onlyFarms)] }
  const row = id ? await prisma.announcement.update({ where: { id }, data }) : await prisma.announcement.create({ data: { ...data, createdBy: actor.name } })
  await audit(actor, [{ tenantId: null, action: id ? "announcement.changed" : "announcement.made", subject: row.id, after: { titleEn: row.titleEn, startsOn: row.startsOn, endsOn: row.endsOn, farms: row.onlyFarms.length || "all" } }])
  return row
}

/** Stops an announcement now: one that is showing ends (shown up to yesterday); one not started yet is removed. */
export async function endAnnouncement(id: string, actor: Actor, now = new Date()) {
  const today = istDate(now)
  const a = await prisma.announcement.findUnique({ where: { id } })
  if (!a) throw new OrderError("not_found")
  if (a.startsOn > today) await prisma.announcement.delete({ where: { id } })
  else await prisma.announcement.update({ where: { id }, data: { endsOn: addDays(today, -1) } })
  await audit(actor, [{ tenantId: null, action: a.startsOn > today ? "announcement.removed" : "announcement.ended", subject: id, before: { titleEn: a.titleEn } }])
}

/** Announcements one farm's staff member sees today, important first. */
export async function announcementsFor(tenantId: string, isOwner: boolean, now = new Date()) {
  const today = istDate(now)
  return prisma.announcement.findMany({
    where: {
      startsOn: { lte: today },
      OR: [{ endsOn: null }, { endsOn: { gte: today } }],
      AND: [{ OR: [{ onlyFarms: { isEmpty: true } }, { onlyFarms: { has: tenantId } }] }, ...(isOwner ? [] : [{ audience: "everyone" }])],
    },
    orderBy: [{ tone: "asc" }, { startsOn: "desc" }],
    take: 3,
  })
}
