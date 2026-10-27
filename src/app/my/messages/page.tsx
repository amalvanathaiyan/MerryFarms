import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { requireTenant } from "@/lib/tenant"
import { featuresOf } from "@/lib/features"
import { getSessionCustomer } from "@/lib/customer-session"
import { pick } from "@/lib/i18n-helpers"
import { markSeen, thread } from "@/server/chat"
import { customerSend } from "@/app/actions/chat"
import { ChatThread } from "@/components/chat/chat-thread"
import { FarmBanner } from "@/components/farm-banner"
import { chatTime } from "@/lib/chat-time"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

/** The customer's conversation with the farm. */
export default async function MyMessagesPage() {
  const tenant = await requireTenant()
  if (!featuresOf(tenant).messages) notFound()
  const me = await getSessionCustomer()
  if (!me) redirect("/my")
  const locale = await getLocale()
  const t = await getTranslations("chat")

  // Opening the conversation marks the farm's replies as seen (the farm sees ✓✓).
  await markSeen(tenant.id, me.id, "customer")
  const messages = await thread(tenant.id, me.id)

  return (
    <div className="min-h-dvh pb-28">
      <FarmBanner name={pick(locale, tenant.nameTa, tenant.nameEn)} initials={tenant.invoicePrefix} href="/my" back={t("back")} help={{ phone: tenant.phone, whatsappNumber: tenant.whatsappNumber ?? tenant.phone }} />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4 sm:px-6">
        <p className="rounded-xl bg-accent p-3 text-sm">{t("customerHint")}</p>
        <ChatThread
          messages={messages.map((m) => ({ id: m.id, mine: m.sender === "customer", body: m.body, time: chatTime(m.createdAt, locale), seen: !!m.seenAt }))}
          send={async (body: string) => {
            "use server"
            return customerSend({ body })
          }}
          placeholder={t("placeholder")}
        />
      </main>
    </div>
  )
}
