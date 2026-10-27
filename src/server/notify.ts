import "server-only"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"
import { featuresOf } from "@/lib/features"
import { tenantDb } from "@/lib/tenant-db"
import { customerOrderNote, type Note } from "@/domain/notifications"
import { orderCode } from "@/domain/orders"
import { dayLabel } from "@/lib/i18n-helpers"
import { formatRupees } from "@/domain/money"
import type { Tenant } from "@/lib/tenant"
import { cloudConfigured, sendTemplate } from "./whatsapp-cloud"

export type { Note }

type Sub = { id: string; endpoint: string; p256dh: string; auth: string }
type Sender = (sub: Sub, payload: string) => Promise<void>

/**
 * Sends one push. Without VAPID keys (e.g. the local demo) it does nothing, so the app
 * still works and messages are noticed through badges and "Seen" ticks.
 */
let sender: Sender = async (sub, payload) => {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
    vapidDetails: { subject: process.env.VAPID_SUBJECT || "mailto:admin@example.com", publicKey: pub, privateKey: priv },
    TTL: 60 * 60 * 24, // a phone that's off gets it within a day, or not at all
    urgency: "high",
  })
}

/** Tests swap the sender to see what would be sent. */
export function setPushSenderForTests(s: Sender) {
  sender = s
}

async function pushOn(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } })
  return !!t && featuresOf(t).pushNotifications
}

/** Sends to each phone; forgets phones that no longer accept notifications. Never throws. */
async function deliver(tenantId: string, subs: Sub[], note: Note) {
  const db = tenantDb(tenantId)
  const payload = JSON.stringify(note)
  await Promise.all(
    subs.map(async (s) => {
      try {
        await sender(s, payload)
        await db.pushSubscription.updateMany({ where: { id: s.id }, data: { lastSentAt: new Date() } })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // 404/410: the browser dropped this subscription (app removed, permission revoked).
        if (status === 404 || status === 410) await db.pushSubscription.deleteMany({ where: { id: s.id } })
        else console.error("[push] send failed:", status ?? (e as Error).message)
      }
    })
  )
}

/** A notification failing must never fail the order or message that caused it. */
async function quietly(fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    console.error("[push]", (e as Error).message)
  }
}

/** To the farm's order desk and owner phones. */
export async function notifyStaff(tenantId: string, note: Note): Promise<void> {
  await quietly(async () => {
    if (!(await pushOn(tenantId))) return
    const db = tenantDb(tenantId)
    const desk = await db.staffMember.findMany({ where: { isActive: true, roles: { hasSome: ["owner", "order_desk"] } }, select: { id: true } })
    const subs = await db.pushSubscription.findMany({ where: { staffId: { in: desk.map((d) => d.id) } } })
    await deliver(tenantId, subs, note)
  })
}

/** To every phone where this customer allowed notifications. */
export async function notifyCustomer(tenantId: string, customerId: string, note: Note): Promise<void> {
  await quietly(async () => {
    if (!(await pushOn(tenantId))) return
    const subs = await tenantDb(tenantId).pushSubscription.findMany({ where: { customerId } })
    await deliver(tenantId, subs, note)
  })
}

const TOLD: Record<string, "confirmed" | "out_for_delivery" | "delivered" | "cancelled"> = {
  confirmed: "confirmed",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
}

/** Tells the customer where their order now stands (confirmed, on the way, delivered, cancelled). */
export async function notifyOrderStatus(tenantId: string, orderId: string): Promise<void> {
  await quietly(async () => {
    const order = await tenantDb(tenantId).order.findFirst({ where: { id: orderId }, include: { customer: true, tenant: true } })
    const kind = order && TOLD[order.status]
    if (!order || !kind) return
    const lang = order.customer.language
    const day = dayLabel(order.slotDate, lang, lang === "ta" ? { today: "இன்று", tomorrow: "நாளை" } : { today: "Today", tomorrow: "Tomorrow" })
    const note = customerOrderNote(kind, lang, {
      farm: lang === "ta" ? order.tenant.nameTa : order.tenant.nameEn,
      code: orderCode(order.tenant.invoicePrefix, order.number),
      slotText: order.slotLabel ? `${day} ${order.slotLabel}` : undefined,
      totalPaise: order.totalPaise,
    })
    await notifyCustomer(tenantId, order.customerId, note)
  })
}

/** Whether this customer has any phone taking notifications (staff then know a WhatsApp nudge may not be needed). */
export async function customerHasPush(tenantId: string, customerId: string) {
  return (await tenantDb(tenantId).pushSubscription.count({ where: { customerId } })) > 0
}

export async function saveSubscription(tenantId: string, owner: { customerId: string } | { staffId: string }, sub: { endpoint: string; p256dh: string; auth: string }) {
  const data = { ...sub, customerId: "customerId" in owner ? owner.customerId : null, staffId: "staffId" in owner ? owner.staffId : null }
  await tenantDb(tenantId).pushSubscription.upsert({
    where: { tenantId_endpoint: { tenantId, endpoint: sub.endpoint } },
    update: data,
    create: { tenantId, ...data },
  })
}

/**
 * New web order: a WhatsApp message to the farm's own number, sent from FarmForYou's
 * WhatsApp Business number. Does nothing until that account is set up.
 */
export async function alertFarmOnWhatsApp(tenant: Tenant, o: { code: string; customerName: string; totalPaise: number; items: string; needsCall: boolean }): Promise<void> {
  await quietly(async () => {
    if (!cloudConfigured() || !featuresOf(tenant).whatsappAlerts) return
    const lang = tenant.defaultLanguage === "en" ? "en" : "ta"
    const call = o.needsCall ? (lang === "ta" ? " · அழைக்க வேண்டும்" : " · call to confirm") : ""
    await sendTemplate(tenant.whatsappNumber || tenant.phone, {
      name: process.env.WHATSAPP_ALERT_TEMPLATE ?? "new_order_alert",
      lang,
      body: [o.code, o.customerName, `${formatRupees(o.totalPaise)}${call}`, o.items.slice(0, 500)],
    })
  })
}
