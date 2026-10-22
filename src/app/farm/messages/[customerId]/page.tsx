import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { MessageCircle, Phone } from "lucide-react"
import { requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { absoluteUrl } from "@/lib/urls"
import { chatTime, hoursSince } from "@/lib/chat-time"
import { markSeen, thread } from "@/server/chat"
import { ensureToken } from "@/server/customers"
import { templateOverrides } from "@/server/messages"
import { farmSend } from "@/app/actions/chat"
import { fillTemplate, templateText } from "@/domain/templates"
import { formatIndianMobile } from "@/domain/phone"
import { waMeLink } from "@/domain/whatsapp-lite"
import { Button } from "@/components/ui/button"
import { ChatThread } from "@/components/chat/chat-thread"

/** One customer's conversation, with fallbacks when a reply goes unseen. */
export default async function FarmThreadPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params
  const { tenant, db, staff } = await requireStaff()
  requireFeature(tenant, "messages")
  const features = featuresOf(tenant)
  const locale = await getLocale()
  const t = await getTranslations("chat")
  const customer = await db.customer.findFirst({ where: { id: customerId } })
  if (!customer) notFound()
  const canReply = staff.roles.includes("owner") || staff.roles.includes("order_desk")

  await markSeen(tenant.id, customerId, "farm")
  const messages = await thread(tenant.id, customerId)

  // The farm's latest reply hasn't been opened by the customer for 2 hours: offer a nudge.
  const lastFarm = [...messages].reverse().find((m) => m.sender === "farm")
  const unseenHours = lastFarm && !lastFarm.seenAt ? hoursSince(lastFarm.createdAt) : 0
  const nudge = lastFarm && !lastFarm.seenAt
  let waNudge: string | null = null
  if (nudge && features.whatsappLite) {
    const link = await absoluteUrl(`/my/${await ensureToken(tenant.id, customer.id)}`)
    const farm = customer.language === "ta" ? tenant.nameTa : tenant.nameEn
    const preview = lastFarm.body.length > 80 ? `${lastFarm.body.slice(0, 80)}…` : lastFarm.body
    waNudge = waMeLink(customer.phone, fillTemplate(templateText("new_message", customer.language, await templateOverrides(tenant.id)), { name: customer.name, farm, preview, link }))
  }

  return (
    <div className="flex flex-col gap-3 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/farm/customers/${customer.id}`} className="text-lg font-bold underline-offset-4 hover:underline">
            {customer.name}
          </Link>
          <p className="text-sm text-muted-foreground tabular-nums">{formatIndianMobile(customer.phone)}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`tel:${customer.phone}`}>
            <Phone /> {t("call")}
          </a>
        </Button>
      </div>

      {nudge && (
        <div className="flex flex-col gap-2 rounded-xl bg-yolk p-3 text-sm text-yolk-foreground">
          <p className="font-medium">{unseenHours >= 2 ? t("notSeenLong", { hours: Math.floor(unseenHours) }) : t("notSeenYet")}</p>
          <div className="flex flex-wrap gap-2">
            {waNudge && (
              <Button asChild size="sm" variant="outline" className="bg-card">
                <a href={waNudge} target="_blank" rel="noreferrer">
                  <MessageCircle /> {t("nudgeWhatsApp")}
                </a>
              </Button>
            )}
            <Button asChild size="sm" variant="outline" className="bg-card">
              <a href={`tel:${customer.phone}`}>
                <Phone /> {t("call")}
              </a>
            </Button>
          </div>
        </div>
      )}

      <ChatThread
        messages={messages.map((m) => ({ id: m.id, mine: m.sender === "farm", body: m.body, time: chatTime(m.createdAt, locale), seen: !!m.seenAt }))}
        send={async (body: string) => {
          "use server"
          return farmSend({ customerId, body })
        }}
        placeholder={canReply ? t("replyPlaceholder") : t("readOnly")}
      />
    </div>
  )
}
